# QA Verification Pass - Kommit v1

*Verification pass against `fix/qa-criticals` (`ab57966`) and `fix/qa-m3-money-helpers` (`c290009`). 2026-05-05. Reviewer: QA verification instance.*

## Summary

Verdict: **HOLD.** Most non-C1 fixes are structurally present, and the frontend M3 branch is clean, but the engineer branch still has a critical harvest residual: Kommit's new KLend reserve value formula omits fee fields that KLend excludes from depositor supply, so permissionless harvest can still route principal as "yield".

Scope note: Helius and Solana Dev MCP tools were exposed, but Helius account reads reported missing API key and Solana Dev MCP returned `null` for the devnet KLend reserve, so live RPC inspection was partial. Static review used the checked-in KLend IDL plus `/tmp/kommit-qa-refs/klend-sdk`. `solana` and `psql` are still not on PATH.

## Verification verdicts

### Critical (C1-C4)

| ID | Verdict | Notes |
|---|---|---|
| C1 | **PARTIAL - CRITICAL residual** | The signature change is real: `lib.rs:83` exposes `harvest(ctx, min_yield)` and `harvest.rs:115` takes only `min_yield`. `lending_position.supplied` is read at `harvest.rs:133` and is not decremented; only `last_harvest_ts` is changed at `harvest.rs:211-213`. However `ReserveSnapshot` only stores available, borrowed, and cToken supply at `adapters/kamino.rs:63-66`, and `total_liquidity()` is just `available + (borrowed >> 60)` at `adapters/kamino.rs:103-106`. KLend's IDL includes accumulated protocol, referrer, and pending referrer fee fields at `idls/kamino_lending.json:6863`, `:6870`, `:6877`, and the klend SDK's `getTotalSupply()` subtracts those fields. Kommit therefore overestimates cToken value at `harvest.rs:132-141`; a caller can set low `min_yield`, burn cTokens that are still principal under KLend's exchange rate, and route the observed redeem delta at `harvest.rs:174-200`. This preserves the original principal-routing class through a new math path. |
| C2 | **FIXED** | `KaminoAdapterConfig` PDA exists with singleton seed and 8 pubkeys plus bump at `state.rs:128-146`. Admin init is present in `lib.rs:98-113` and gates `admin == config.admin` at `initialize_kamino_adapter_config.rs:37-41`. `supply_to_yield_source` validates reserve, market, authority, liquidity mint, liquidity supply, collateral mint, and klend program before CPI at `supply_to_yield_source.rs:99-105`; `harvest` does the same at `harvest.rs:118-124`. Negative supply tests cover wrong reserve and wrong market at `tests/kommit.ts:822` and `:877`. |
| C3 | **FIXED, with test gap** | Migration `0002_event_identity.sql` drops the old `(tx_hash, event_name)` constraint at `:25`, adds `instruction_index` and `event_index` at `:27-29`, and enforces `unique (tx_hash, instruction_index, event_index)` at `:37-40`. The handler walks logs and derives per-instruction event positions in `route.ts:80-137`, then sends those to `process_event` at `route.ts:246-251`. Same-name events in one tx now get distinct identities; same-slot commit/supply/harvest materializers are additive rather than slot-blocked. I did not find webhook fixture tests for this path. |
| C4 | **FIXED, with test gap** | `process_event` records the event and dispatches materialization in one PL/pgSQL function at `0002_event_identity.sql:263-344`; duplicate inserts return `false` at `:278-289`, while materialize exceptions roll back the function call. The handler no longer swallows event failures: RPC errors are thrown at `route.ts:255-260`, collected at `route.ts:266-275`, and any failure returns HTTP 500 at `route.ts:279-284`. No automated webhook failure/retry test was added. |

### High (H1-H3)

| ID | Verdict | Notes |
|---|---|---|
| H1 | **FIXED** | `ProjectCreated` now includes `metadata_uri_hash` at `events.rs:4-9`, `create_project` emits it at `create_project.rs:44-48`, and SQL materialization decodes `metadataUriHashHex` instead of using a zero buffer at `0002_event_identity.sql:293-298`. The webhook normalizer creates the hex sibling for byte arrays at `route.ts:194-202`. Event assertion exists at `tests/kommit.ts:1058-1093`. |
| H2 | **PARTIAL** | New supply allowlist negatives exist at `tests/kommit.ts:822` and `:877`, and five Rust `ReserveSnapshot` unit tests exist at `adapters/kamino.rs:157`, `:167`, `:176`, `:188`, `:196`. The claimed harvest integration coverage is missing: no test calls `harvest`, no test proves supplied principal remains withdrawable after an attempted max-collateral harvest, and no test covers the KLend fee-field mismatch behind the C1 residual. |
| H3 | **FIXED** | `deploy_mainnet.sh` no longer prompts. Existing-program flow defaults to abort unless `ALLOW_UPGRADE=true` at `scripts/deploy_mainnet.sh:90-99`. |

### Medium (M1-M3)

| ID | Verdict | Notes |
|---|---|---|
| M1 | **FIXED** | `commit` top-up stores `delta = commitment.accrue(now)` and emits `PointsAccrued` with that delta and the post-accrual lifetime total at `commit.rs:83-94`. `withdraw` does the same after inline accrual at `withdraw.rs:91-102`. |
| M2 | **PARTIAL** | `ProjectNotFound` is gone from `errors.rs:3-20`, and the new negative tests for pause, unpause, commit zero, withdraw over-principal, and withdraw zero are present at `tests/kommit.ts:978`, `:995`, `:1014`, `:1026`, `:1043`. The adapter-config non-admin test at `tests/kommit.ts:928-973` accepts "already in use" as success at `:963-970`, so it does not reliably assert the intended `Unauthorized` path. The test-file comment still claims signer-mismatch withdraw coverage at `tests/kommit.ts:732`, but no such test exists. |
| M3 | **FIXED** | On `fix/qa-m3-money-helpers`, `money.ts` provides exact `parseTokenAmount`, `formatTokenAmount`, `formatScore`, `validateAmount`, and `toBigInt` helpers at `web/src/lib/money.ts:29`, `:61`, `:116`, `:149`, `:184`. `tx.ts` takes string amounts and converts through bigint to BN at `web/src/lib/tx.ts:43-50`, `:58`, `:90`; the old `Math.round(amount * 10**6)` path is gone. Commit and withdraw modals wire `validateAmount` and disable submit on error at `commit-modal.tsx:44`, `:67`, and `withdraw-modal.tsx:62`, `:74`. `npm test` passed 39/39 and `npm run build` passed. |

### Low (L1-L2)

| ID | Verdict | Notes |
|---|---|---|
| L1 | **FIXED** | Webhook auth imports `timingSafeEqual` at `route.ts:23`, length-checks first at `route.ts:70`, and compares buffers at `route.ts:72-74`. |
| L2 | **FIXED** | `create_project.ts` infers Solscan suffix from `ANCHOR_PROVIDER_URL`: mainnet gets no suffix, devnet/testnet get cluster suffixes at `scripts/create_project.ts:91-102`. |

### Documentation

| Claim | Verdict | Notes |
|---|---|---|
| `SECURITY_REVIEW.md` section 8 and verdict rewritten | **PARTIAL** | The doc acknowledges the original C1/C2 miss at `SECURITY_REVIEW.md:159-166` and `:241`, but it now states "After the fixes, the program contains no known unintended fund-movement paths" at `SECURITY_REVIEW.md:243`. That is false until the C1 fee-accounting residual is fixed. |
| README Next.js version | **FIXED** | `README.md:44` and `README.md:109` now say Next.js 16.2.4, and `rg "Next.js 14"` found no hits. |
| SETUP placeholder-ID step removed | **FIXED** | `SETUP.md:63-74` now says the real program ID is committed and contributors do not swap a placeholder. |
| `create_project.ts` lazy-IPFS comment updated | **FIXED** | `scripts/create_project.ts:12-18` now says `metadata_uri_hash` arrives directly on `ProjectCreated`; no follow-up account fetch is claimed. |

## New findings

### CRITICAL N1. Harvest reserve math ignores KLend fee fields and can still route principal

`ReserveSnapshot` reads only available liquidity, borrowed liquidity, and cToken supply (`adapters/kamino.rs:63-66`), then computes total liquidity as `available + borrowed` (`adapters/kamino.rs:103-106`). KLend's reserve layout also has `accumulated_protocol_fees_sf`, `accumulated_referrer_fees_sf`, and `pending_referrer_fees_sf` (`idls/kamino_lending.json:6863`, `:6870`, `:6877`), and the klend SDK subtracts those when computing depositor supply. Because Kommit overestimates cToken value before computing `yield_amount` (`harvest.rs:132-141`), a permissionless caller with low `min_yield` can redeem cTokens that are not true excess yield and forward the actual redeemed USDC to the recipient (`harvest.rs:174-200`). This is still a principal-loss path.

### MEDIUM N2. SETUP applies only migration 0001, so fresh indexer wiring misses C3/C4

`SETUP.md:106-113` names and applies only `migrations/supabase/0001_initial_schema.sql`. The engineer fix requires `migrations/supabase/0002_event_identity.sql` for `process_event`, new event identity columns, and the new unique constraint. Following the docs on a fresh Supabase project leaves the webhook calling a missing SQL function and returning 500 for all events, or leaves the old C3/C4 schema in place.

### LOW N3. README still documents the old harvest argument shape

`README.md:26` still says the off-chain crank calls `harvest(collateral_amount, min_yield)`. The fixed program signature is `harvest(ctx, min_yield)` at `lib.rs:83`.

## Regressions

- Critical residual/regression in C1: the new on-chain harvest math removes caller-supplied `collateral_amount`, but introduces an incomplete KLend exchange-rate model that can still route principal.
- No build regression found in the web app. `npm run build` passed on both fix branches after `npm ci`.
- Anchor integration tests were not verified because this environment still lacks `solana`/`cargo build-sbf`, and `anchor test --skip-build` still panics in `system-configuration`.

## Test Coverage Delta

- Original: 17 Anchor TS tests across the v1 surface.
- Engineer branch static count: 26 Anchor TS tests plus 5 Rust `ReserveSnapshot` unit tests.
- Frontend M3 branch: 39 Vitest unit tests in `web/src/lib/money.test.ts`.
- Verified passing: `NO_DNA=1 cargo test -p kommit --lib` passed 6/6; `npm test` on M3 passed 39/39; `npm run build` passed on both fix branches.
- Blocked: `NO_DNA=1 anchor build` failed with `error: no such command: build-sbf`; `NO_DNA=1 anchor test --skip-local-validator --skip-build` panicked in `system-configuration`; `psql` was missing, so SQL was static-reviewed only.
- Remaining gaps: no harvest integration/regression test, no C1 fee-field math test, no webhook C3/C4 same-name/same-slot/failure-retry fixture, adapter-config non-admin test does not prove `Unauthorized`, and signer-mismatch withdraw remains absent despite the test comment.

## Verdict

**HOLD.**

Do not proceed to mainnet deploy or private-beta principal on `fix/qa-criticals` as-is. Minimum unblock list:

- Fix harvest value accounting to match KLend's redeem exchange-rate model, including fee fields, or disable `harvest` until principal preservation can be proven.
- Add deterministic harvest tests covering fee-field overestimation, zero-yield reserves, and "principal remains withdrawable" after adversarial harvest attempts.
- Update `SECURITY_REVIEW.md`, `README.md`, and `SETUP.md` after the harvest/indexer-doc gaps are corrected.

`fix/qa-m3-money-helpers` is ship-clean for M3 by itself.
