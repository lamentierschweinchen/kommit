# Kommit — Security Review (v1, hackathon-private-beta-grade)

*Self-audit pass against the Anchor security checklist. Performed 2026-05-03 against `programs/kommit/` at commit `2591f44` on `spike/yield-source-klend` (chunks 1–3 of handoff 06 landed). Re-run before mainnet deploy.*

This review is hackathon-grade — appropriate for the private-beta launch
posture documented in [`build_order.md`](../build_order.md) (whitelisted
committers, single-sig admin, single-sig program upgrade authority). It
is **not** a substitute for a third-party audit before scaling beyond
private beta — see "Verdict" at the end for the v1.5/v2 upgrade items
gating that scaling.

---

## 1. PDA seeds correctness

**Status:** PASS.

All seed constants are defined in [`programs/kommit/src/state.rs`](programs/kommit/src/state.rs):

| Constant | Value | Used by |
|---|---|---|
| `KommitConfig::SEED` | `b"config"` | `KommitConfig` PDA |
| `Project::SEED` | `b"project"` | `Project` PDA, plus `recipient_wallet` |
| `Commitment::SEED` | `b"commitment"` | `Commitment` PDA, plus `user`, `project` |
| `Commitment::ESCROW_SEED` | `b"escrow"` | per-project USDC escrow PDA, plus `project` |
| `Commitment::COLLATERAL_SEED` | `b"collateral"` | per-project cToken PDA, plus `project` |
| `LendingPosition::SEED` | `b"lending"` | `LendingPosition` PDA, plus `project`, `&[adapter_id]` |

Tests in `tests/kommit.ts` derive each PDA via `findProgramAddressSync`
with the same byte sequences (e.g. `Buffer.from("config")` at
[`tests/kommit.ts:25`](tests/kommit.ts:25)). The tests pass — if a seed
were mismatched, the program would create a different PDA than the test
expects and the very first `init` call would fail.

No magic strings on the program side; no magic strings on the test side
that aren't paired with the constant they mirror.

## 2. CPI signer seeds

**Status:** PASS.

Three places use `invoke_signed` (escrow / collateral PDA signs an
external CPI):

1. **`withdraw` escrow → user transfer** —
   [`instructions/withdraw.rs:198-209`](programs/kommit/src/instructions/withdraw.rs).
   Signer seeds `[ESCROW_SEED, project_key, &[escrow_bump]]` match the
   escrow PDA's account-level seeds at line 70-72. Verified by
   `withdraw_full_zeroes_active_preserves_lifetime` and
   `withdraw_partial_scales_active_score` in `tests/kommit.ts`.

2. **`supply_to_yield_source` escrow → klend deposit** —
   [`instructions/supply_to_yield_source.rs:113-117`](programs/kommit/src/instructions/supply_to_yield_source.rs).
   Same escrow PDA seeds; the escrow signs as klend's `owner` for
   `deposit_reserve_liquidity`. Will be verified end-to-end by the
   devnet smoke (gated; see `scripts/smoke_klend_devnet.ts`).

3. **`harvest` collateral → recipient redeem** —
   [`instructions/harvest.rs:84-90`](programs/kommit/src/instructions/harvest.rs)
   and **`withdraw` klend redeem** —
   [`instructions/withdraw.rs:152-156`](programs/kommit/src/instructions/withdraw.rs).
   Signer seeds `[COLLATERAL_SEED, project_key, &[collateral_bump]]`
   match the collateral PDA's account-level seeds. The collateral PDA
   signs as klend's `owner` for `redeem_reserve_collateral`.

In all three, the bump is read from `ctx.bumps.<account>` (Anchor's
canonical bump), not re-derived — eliminates the off-by-one risk that
comes from re-running `find_program_address` and using the wrong return
value.

## 3. Ownership / authority checks

**Status:** PASS.

**Admin-gated instructions:** every one calls `require_keys_eq!(admin.key(), config.admin, KommitError::Unauthorized)`.

- `create_project` — [`instructions/create_project.rs:30-34`](programs/kommit/src/instructions/create_project.rs); test `create_project_rejects_non_admin`
- `admin_pause` — [`instructions/admin_pause.rs:14-18`](programs/kommit/src/instructions/admin_pause.rs)
- `admin_unpause` — [`instructions/admin_pause.rs:24-28`](programs/kommit/src/instructions/admin_pause.rs)
- `admin_update_project_metadata` — [`instructions/admin_update_project_metadata.rs:20-24`](programs/kommit/src/instructions/admin_update_project_metadata.rs); test `admin_update_project_metadata_rejects_non_admin`

**User-gated instructions:** `withdraw` requires `commitment.user == user.key()` via Anchor's `has_one = user` constraint at [`instructions/withdraw.rs:65`](programs/kommit/src/instructions/withdraw.rs:65). Anchor enforces this automatically — withdrawal by a non-owner reverts before the handler runs.

**Permissionless cranks** (no auth required by design): `commit` (any user can deposit their own USDC), `accrue_points`, `supply_to_yield_source`, `harvest` (yield only routes to `project.recipient_wallet`, never to the caller — see item 8).

## 4. Math overflow guards

**Status:** PASS.

All scalar arithmetic on principal / scores uses `checked_*` or `u128`:

- `Commitment::accrue` — [`state.rs:67-78`](programs/kommit/src/state.rs:67) — `principal as u128 * elapsed as u128`, both addends `checked_add`. Maximum theoretically representable: `u64::MAX × u64::MAX = u128::MAX/2`, fits comfortably in `u128`.
- `commit` weighted-avg `deposit_ts` — [`commit.rs:91-97`](programs/kommit/src/instructions/commit.rs:91) — three `checked_mul`/`checked_add` calls, all in `u128`. Final divide is by `u128` total > 0 (caller validated `amount > 0`).
- `commit` principal accumulation — [`commit.rs:103-105`](programs/kommit/src/instructions/commit.rs:103) — `checked_add`.
- `commit` `Project::cumulative_principal` — [`commit.rs:111`](programs/kommit/src/instructions/commit.rs:111) — `checked_add`.
- `withdraw` partial-scaled `active_score` — [`withdraw.rs:217-220`](programs/kommit/src/instructions/withdraw.rs:217) — `checked_mul(u128) / u128`. Divisor is `old_principal as u128` which is > 0 by the prior `amount > 0` + `amount <= old_principal` checks.
- `supply_to_yield_source` `LendingPosition::supplied` — [`supply_to_yield_source.rs:135-138`](programs/kommit/src/instructions/supply_to_yield_source.rs:135) — `checked_add`.
- `harvest` `Project::cumulative_yield_routed` — [`harvest.rs:115-118`](programs/kommit/src/instructions/harvest.rs:115) — `checked_add`.

**`saturating_*` use** (intentional, documented):

- `Commitment::accrue` elapsed = `now.saturating_sub(last_accrual_ts)` — [`state.rs:62`](programs/kommit/src/state.rs:62). Reason: clock can theoretically appear to go backward across slots (though shouldn't); saturating preserves the idempotency invariant.
- `withdraw` redeemed_usdc = `new_escrow_balance.saturating_sub(escrow_balance)` — [`withdraw.rs:177`](programs/kommit/src/instructions/withdraw.rs:177). Reason: escrow can only grow during a redeem CPI; saturating is defensive against a malformed klend response.
- `withdraw` `lending_position.supplied.saturating_sub(redeemed_usdc)` — [`withdraw.rs:183`](programs/kommit/src/instructions/withdraw.rs:183). Reason: same — defensive against weird redeem outputs.
- `harvest` `routed = recipient_balance_after.saturating_sub(before)` — [`harvest.rs:109`](programs/kommit/src/instructions/harvest.rs:109). Reason: same defensive pattern.

`u128` is mandatory for both `active_score` and `lifetime_score` (see [`state.rs:46-47`](programs/kommit/src/state.rs:46)). At max plausible TVL × time horizon (10⁹ USDC base units × 10⁹ seconds = 10¹⁸ ≪ u128::MAX), no realistic overflow path.

## 5. Rent-exemption

**Status:** PASS.

Every `init` / `init_if_needed` call allocates `8 + Account::SIZE`:

- `KommitConfig` — [`initialize_config.rs:8-13`](programs/kommit/src/instructions/initialize_config.rs:8) — `8 + KommitConfig::SIZE` (= 8 + 34)
- `Project` — [`create_project.rs:9-14`](programs/kommit/src/instructions/create_project.rs:9) — `8 + Project::SIZE` (= 8 + 89)
- `Commitment` — [`commit.rs:14-19`](programs/kommit/src/instructions/commit.rs:14) — `8 + Commitment::SIZE` (= 8 + 121)
- `LendingPosition` — [`supply_to_yield_source.rs:46-52`](programs/kommit/src/instructions/supply_to_yield_source.rs:46) — `8 + LendingPosition::SIZE` (= 8 + 82)
- Token accounts (`escrow_token_account`, `collateral_token_account`) use Anchor's `token::*` size defaults (165B for SPL token accounts, 82B for mints).

The constant 8 covers the Anchor account discriminator. The `SIZE` constants in `state.rs` are declared as the sum of each field's byte width; verified against the field types.

## 6. Token program calls

**Status:** PASS.

All SPL token transfers use `anchor_spl::token` helpers:

- `commit` — `token::transfer(user_usdc → escrow)` at [`commit.rs:62-71`](programs/kommit/src/instructions/commit.rs:62)
- `withdraw` — `token::transfer(escrow → user)` at [`withdraw.rs:198-209`](programs/kommit/src/instructions/withdraw.rs:198)
- `supply_to_yield_source` — klend CPI `deposit_reserve_liquidity` (hand-rolled in `adapters/kamino.rs`); the user_source / user_destination account ordering matches klend's IDL
- `harvest`, `withdraw` (klend path) — klend CPI `redeem_reserve_collateral` (hand-rolled in `adapters/kamino.rs`); same

ATA derivations for the recipient's USDC account use `token::mint = usdc_mint` and `token::authority = project.recipient_wallet` constraints at [`harvest.rs:41-43`](programs/kommit/src/instructions/harvest.rs:41) — Anchor enforces the canonical ATA at validation time.

The escrow + collateral PDA token accounts are intentionally **not** ATAs — they're PDA-derived token accounts with self-authority. Created via `init_if_needed` with explicit `token::authority = <self>`. Documented in the doc-comments on each instruction's `Accounts` struct.

## 7. Admin can't drain user funds

**Status:** PASS.

Walked through every admin-gated instruction:

- `initialize_config` — sets `config.admin` and `config.paused`. No token movement.
- `create_project` — initializes a `Project` PDA. No token movement.
- `admin_pause` / `admin_unpause` — toggles `config.paused`. No token movement. **Pause does not affect withdrawals** (item 9).
- `admin_update_project_metadata` — overwrites `project.metadata_uri_hash`. No token movement.

There is **no admin instruction that takes any token account as `mut` other than `config`/`project` PDAs**. The only token transfers in the program are in `commit` (user → escrow, signed by user), `withdraw` (escrow → user, signed by escrow PDA which only signs for that user's withdraw), and the klend CPI paths in `supply_to_yield_source` (escrow → klend, signed by escrow) and `harvest` (cToken → recipient, signed by collateral PDA). None of these are admin-callable.

The admin's only on-chain power is curation (which projects exist, which can rotate metadata) plus the pause kill-switch. No spend authority.

## 8. Yield (only the yield) flows to `recipient_wallet`

**Status:** PASS — after the QA C1 fix on `fix/qa-criticals`.

`harvest` redeems cTokens for USDC into `harvest_landing_usdc` (a token account owned by the collateral PDA), then forwards the observed delta to `recipient_token_account` (constrained at [`harvest.rs`](programs/kommit/src/instructions/harvest.rs) to have `authority = project.recipient_wallet`). The destination cannot be substituted by the caller.

**Critical update (QA 2026-05-05):** the prior harvest design accepted a caller-supplied `collateral_amount` and forwarded the entire redeem delta — meaning a caller could redeem the project's principal and route it to the recipient. The redesign **computes the yield amount on-chain** by reading klend's reserve account state:

1. `redeemable_value = collateral_token_balance × klend_total_liquidity / klend_collateral_total_supply`
2. `yield_amount = redeemable_value − lending_position.supplied`  (saturating)
3. Caller passes `min_yield`; if `yield_amount < min_yield` → `DustHarvest` (no CPI fired)
4. Compute `ctokens_to_redeem` for `yield_amount` only; CPI redeem; transfer
5. Re-validate `routed >= min_yield` against the actual delta (defence against klend rate changes)
6. **Do NOT decrement `lending_position.supplied`** — principal stays continuously supplied

`project.recipient_wallet` itself is set at `create_project` time by the admin (the recipient is whoever the admin specifies for the founding team) and is **not modifiable** in v1. (Recipient rotation is a deferred v1.5 instruction, `admin_update_project_recipient`, intentionally omitted from this handoff per `program_spec.md` "open implementation questions".)

The `withdraw` klend-redeem path lands USDC in the project's escrow PDA, then immediately transfers `amount` to the user. The redeemed-but-not-withdrawn-yet remainder stays in the escrow — never goes to the recipient implicitly via `withdraw`. (Yield routing to recipient is `harvest`'s job.)

## 9. Withdrawal pause invariant

**Status:** PASS.

`withdraw` does **not** check `config.paused`. The `Withdraw` struct doesn't even include `config` ([`withdraw.rs:50-71`](programs/kommit/src/instructions/withdraw.rs:50)). The handler comment at line 53 documents the invariant: *"Withdrawals are NEVER gated by `config.paused` — kill-switch invariant."*

Test: `withdraw_succeeds_when_paused` in `tests/kommit.ts` — pauses via `admin_pause`, then successfully withdraws. Test passes.

`commit` and `supply_to_yield_source` both check `!config.paused` (commit at [`commit.rs:54`](programs/kommit/src/instructions/commit.rs:54), supply at [`supply_to_yield_source.rs:84`](programs/kommit/src/instructions/supply_to_yield_source.rs:84)). Inflows are paused; outflows are not. Users can always exit.

## 10. Reentrancy / CPI safety

**Status:** PASS (Solana doesn't have EVM-style reentrancy, but verified the post-CPI state-mutation discipline).

Solana's runtime serializes account state per instruction, so EVM-style "reentrancy via callback" doesn't exist in the same form. But two patterns to verify:

- **State mutation after CPI without re-validating accounts:** in `withdraw`'s klend-redeem branch, after `redeem_reserve_collateral` the handler reloads `escrow_token_account` ([`withdraw.rs:172`](programs/kommit/src/instructions/withdraw.rs:172)) before reading the new balance. This prevents using a stale snapshot of the escrow balance. The `lending_position` deserialize-modify-serialize cycle ([`withdraw.rs:181-185`](programs/kommit/src/instructions/withdraw.rs:181)) reads from `try_borrow_mut_data()` which gives the live account data, not a cached version.
- **Cross-CPI invariant break:** the only cross-CPI sequence that mutates Kommit state is `withdraw`'s escrow → user transfer following the optional klend redeem. The commitment-side state mutation (`principal -= amount`, score scaling) happens **after** all CPIs ([`withdraw.rs:213-225`](programs/kommit/src/instructions/withdraw.rs:213)). If any CPI reverts, the whole transaction reverts and no commitment state is changed.

## 11. Account ownership validation

**Status:** PASS.

- Every `Account<'info, T>` parameter is automatically owner-checked by Anchor — Anchor refuses to deserialize an account whose owner doesn't match the program ID for accounts owned by Kommit, or the SPL token program for `TokenAccount` / `Mint`.
- Untyped `AccountInfo` parameters in `withdraw`'s `remaining_accounts` are validated **manually** at [`withdraw.rs:121-148`](programs/kommit/src/instructions/withdraw.rs:121): the collateral PDA's address is recomputed via `find_program_address` and compared with `require_keys_eq!`; the lending_position PDA likewise. The 12 klend accounts in `remaining_accounts` slots 2–13 are passed straight to klend's CPI — klend will reject them if they don't match its own internal expectations (e.g. the reserve must match the lending_market, etc.). We don't double-check klend's invariants here; we rely on klend.
- Untyped `AccountInfo` in `supply_to_yield_source` and `harvest` are similarly passed straight to klend, with `/// CHECK:` doc-comments explaining why they're untyped (CPI passthrough).

## 12. Discriminator collision

**Status:** PASS.

Anchor 0.31.x discriminators are 8 bytes derived from `sha256("global:<method_name>")[..8]`. Across our 10 instructions, no discriminator collision is plausible (sha256 collision space is 2^64). Verified by `target/idl/kommit.json` listing 10 distinct discriminators.

We do **not** have any manual instruction handler that bypasses Anchor's discriminator dispatch. Every entry in `lib.rs`'s `#[program]` block is a typed Anchor handler; the macro generates the discriminator check.

The hand-rolled klend CPI in `adapters/kamino.rs` uses klend's own discriminators (extracted from klend's IDL), embedded as constants at the top of the file. They're correctly prepended to the instruction data byte buffer.

## 13. IDL drift

**Status:** PASS.

`target/idl/kommit.json` is regenerated on every `anchor build`. Current state (commit `2591f44`) lists 10 instructions, 4 accounts, 7 events. `target/types/kommit.ts` is regenerated alongside. Tests reference the generated `target/types/kommit` directly, so any drift between source and IDL surfaces immediately as a TS type error.

For mainnet IDL distribution, the deploy script (chunk 5a in this handoff) calls `anchor idl init --filepath target/idl/kommit.json` to publish the IDL on-chain — frontend clients fetch the canonical IDL from chain rather than from a local copy.

## 14. Known limitations (documented up-front)

These are **intentional v1 simplifications**, not security gaps. Each has a planned upgrade path.

1. **Centralized admin (curation + metadata + pause).** The single admin keypair `config.admin` controls `create_project`, `admin_update_project_metadata`, `admin_pause`/`admin_unpause`. v1.5 plan: Squads multisig (3-of-5 or similar) replaces the single-sig admin. Code change: none — `config.admin` is already a `Pubkey` and Squads multisigs present as a Pubkey.

2. **Single-sig admin keypair in v1.** The admin pubkey on mainnet will be Lukas's hardware-wallet address for the initial private-beta cohort. Risk-of-key-compromise → admin can pause + create_project + rotate metadata, but **cannot move user funds** (item 7). v1.5 plan: rotate to Squads.

3. **Single-sig program upgrade authority in v1.** The mainnet program upgrade authority will be the same hardware-wallet address. Risk-of-key-compromise → attacker can deploy a malicious program upgrade. **This is the only v1 risk that lets an attacker drain funds**, since a malicious upgrade can rewrite withdraw to transfer to the attacker. v1.5 plan: rotate upgrade authority to Squads multisig (coordinator's call when Lukas is back per `handoffs/06_complete_onchain_v1.md` chunk 5d). Mitigation in v1: do not announce the program ID publicly until upgrade authority is multisig'd.

4. **No MEV protection on `commit`.** Front-running a USDC commit is theoretically possible (a searcher could observe a commit and submit their own to the same project just before, padding the project's cumulative_principal). Low practical value — the searcher pays a real USDC commit and earns the same yield as the front-run target; the only "win" is points-accrual ordering, which is symmetric. Not worth mitigating in v1.

5. **No KYC / geo-blocking.** Private beta whitelist sidesteps; full posture roadmap in the submission narrative. v1.5 plan: server-side checks before signing transactions for users in restricted jurisdictions (handled in the off-chain stack, not on-chain).

6. **`withdraw`'s klend-redeem path requires off-chain math.** Caller passes `redeem_collateral_amount`; we trust them to compute the right cToken count from klend's exchange rate. If they pass too few, the post-redeem `escrow_balance < amount` check at [`withdraw.rs:188-191`](programs/kommit/src/instructions/withdraw.rs:188) reverts the transaction — no state change, user can retry with a corrected amount. If they pass too many, the surplus stays in escrow (no loss to the user). v2 plan: read klend's reserve state on-chain to compute the right amount, eliminating the off-chain dependency.

7. **`harvest`'s `min_yield` doubles as the only dust threshold.** No on-chain block-height or time-window enforcement against harvest spam. Acceptable in v1 because harvest is permissionless but pays for its own compute — spammers self-throttle.

---

## Verdict

**Security posture: hackathon-private-beta-grade.** Suitable for the documented v1 scope (whitelisted committers, single-sig admin + upgrade authority, $1k self-test → 5–15 hand-curated projects).

**Post-QA (2026-05-05):** the original report claimed "no known unintended fund-movement paths." That was wrong — the QA pass found `harvest` could be called by anyone with arbitrary `collateral_amount` and would route the project's principal to the project recipient (C1), and `supply_to_yield_source` could bind project principal to any klend reserve graph (C2). Both are fixed on `fix/qa-criticals`: harvest now computes the yield amount on-chain and never decrements `lending_position.supplied`; supply now requires key-equality against a `KaminoAdapterConfig` PDA before any CPI. The webhook indexer's idempotency was also redesigned (C3, C4): per-event identity `(tx_hash, instruction_index, event_index)` replaces the prior `(tx_hash, event_name)` key, and a single `process_event` SQL function wraps event-record + materialize in one Postgres transaction.

**Fix-pass-2 follow-up (2026-05-05):** the QA verification pass identified a residual on the C1 fix — `ReserveSnapshot` initially read only `available_liquidity_amount`, `borrowed_amount_sf`, and `mint_total_supply`, omitting klend's three accumulated/pending fee fields (`accumulated_protocol_fees_sf`, `accumulated_referrer_fees_sf`, `pending_referrer_fees_sf`) that klend-sdk's `getTotalSupply()` subtracts from depositor supply. Without that subtraction, `total_liquidity()` overestimated cToken value and a permissionless caller with low `min_yield` could have routed principal as "yield" through a new code path (QA verification N1, same C1 exploitation class). Fix-pass-2 extends `ReserveSnapshot` to read all six fields, makes `total_liquidity()` subtract the fees with saturating arithmetic, and adds two new Rust unit tests covering the fee-field path (`total_liquidity_subtracts_klend_fees`, `total_liquidity_underflow_returns_zero_safely`). The principal-preservation invariant is also covered by integration tests in `tests/kommit.ts` (`harvest_attempt_with_zero_min_yield_does_not_drain_user_principal` plus the structural guard `harvest_attempt_without_prior_supply_fails_safely_lending_position_uninit`).

After the fix-pass-2 fee-field correction (subject to QA verification pass 2), the program contains no known unintended fund-movement paths. Admin powers are bounded to curation + pause + adapter-config init, none of which can move user funds. The kill-switch invariant (withdrawals always allowed) is verified by test. The math is in `u128` with `checked_*` everywhere it matters. The CPI signer paths are correctly seeded. The klend reserve graph is allowlisted per-key.

**Pre-scaling-beyond-private-beta upgrade items:**
- Rotate program upgrade authority from single-sig to Squads multisig (item 14.3) — critical, as this is the only v1 risk that lets a key compromise drain funds.
- Rotate `config.admin` to Squads multisig (item 14.2) — important for governance posture as the cohort scales.
- Third-party audit (OtterSec / Neodyme / Sec3) — required before public launch and TVL > ~$100k.
- Re-extract the klend CPI discriminators if klend ships a major release (item 12 / `adapters/kamino.rs` doc-comment).

The deferred-by-design items (`admin_update_project_recipient`, `create_graduation_attestation`, `harvest_all` batch, off-chain harvest crank, points decay model) are documented in `program_spec.md` and `build_order.md` as v1.5 / v2 scope.
