# Kommit — risk surfaces

*Companion to [SECURITY.md](SECURITY.md). Where SECURITY.md covers disclosure / scope / severity for things we'd actually fix or pay out on, this doc names the structural risks that exist by virtue of the architecture itself — the ones a kommitter or a reviewer should know about before touching the product. Last sharpened 2026-05-07.*

---

## What "principal-protected" actually means

Across our public surfaces we describe Kommit as **principal-protected by audited protocols**. That phrasing was chosen carefully:

- **"Protected"** — not "safe," not "guaranteed," not "by construction." Principal returns to the kommitter's wallet on `withdraw` *unless* one of the underlying risk surfaces named below fires.
- **"By audited protocols"** — we lean on Kamino's audit posture and security record. We have not invented a yield engine; we route to one.

What we are *not* claiming: that USDC parked on Kommit is risk-free, that deposits are FDIC-insured (they are not), or that no failure mode exists. The risks below are non-zero. The point of naming them explicitly is that they're the only places things can break — there is no hidden surface.

---

## Risk surfaces

### 1. Kommit smart-contract risk (program-level)

The Kommit Anchor program itself is custom code running on Solana. A bug in `commit`, `withdraw`, `harvest`, `accrue_points`, or any of the lending-adapter glue could move funds incorrectly or strand them.

**Mitigations in place:**
- Anchor 0.31.1; standard PDA seed discipline.
- Internal multi-pass security review (`SECURITY_REVIEW.md`, `SECURITY_HARDENING.md`) — Layer-10 verdict SAFE-TO-GO-PUBLIC after migration `0003` applied. Trail covers signer checks, reentrancy on CPI, integer overflow on point math (`u128`), close-account semantics, and adapter authority.
- Test coverage: `accrue_points` unit tests, integration tests for full commit / harvest / withdraw round-trips on devnet.

**What's still on the table:**
- **No third-party audit yet.** Mainnet-locked behind one. Devnet is "internal review only."
- **Single-sig upgrade authority on devnet.** A compromise of the upgrade keypair would let an attacker swap the program. Recovery procedure documented in [`RECOVERY.md`](RECOVERY.md). Pre-mainnet requirement: Squads multisig as upgrade authority.
- **Single-sig admin authority on devnet** for project curation and recipient rotation. Pre-mainnet requirement: same Squads multisig.

### 2. Yield-source risk (Kamino)

Kommit's v0.5 routes USDC to a single yield source: **Kamino**.

**What can go wrong:**
- **Kamino smart-contract exploit** — they're a separate codebase; their bugs become our bugs the moment funds are supplied. Kamino has been audited multiple times and has a strong security record (see their [security disclosures](https://kamino.finance/)), but no protocol with TVL is exploit-immune.
- **Kamino solvency / utilization stress.** A bank-run scenario where redemption demand exceeds available liquidity could delay withdrawals. Mitigated by Kamino's reserve mechanics, but the failure mode exists.
- **Single-adapter concentration.** v0.5 has only the Kamino adapter wired. There's no diversification across yield venues. v1 ships a second adapter (marginfi or Jupiter Lend) for adapter-swap validation; v2 explores active diversification.

**Mitigations in place:**
- Architecturally adapter-agnostic — the `LendingAdapter` trait isolates yield-source choice from the rest of the program. Adapter swap is a code-path change, not a protocol redesign.
- Per-project escrow + per-project `LendingPosition` PDA — every committer's principal traces to a specific project's escrow on-chain. Verifiability over performance.

### 3. Oracle risk

The yield calculation (`yield_amount = redeemable_value − supplied`) reads `redeemable_value` from Kamino's price feeds, which themselves rely on **Pyth** / **Switchboard** for upstream price discovery on the underlying assets.

**What can go wrong:**
- **Stale or manipulated oracle data** could let `harvest` over-redeem from Kamino.
- **Oracle outage** could block `harvest` until the feed recovers.

**Mitigations in place:**
- `harvest` redeems exactly the calculated yield amount; over-redemption beyond `supplied` is rejected at the program boundary.
- Oracle failure causes harvest to fail loudly — funds remain in Kamino, kommitters can still withdraw their principal independently.

### 4. Counterparty risk (off-chain dependencies)

Kommit relies on third parties for non-program infrastructure:

- **Privy** — embedded wallet provider (passkey + email + Google). A Privy outage blocks new sign-ins and existing-session signing. A Privy compromise of the embedded-wallet keypair generation would be a critical failure mode.
- **Helius** — Solana RPC + webhooks. Outage breaks the indexer and the dashboard live-update loop; on-chain state is unaffected.
- **Pinata** — IPFS pinning for project metadata. If Pinata drops a pin, the metadata becomes unreachable until re-pinned. v0.5 stores the IPFS hash on-chain — recovery is "re-pin from a backup," not "data lost forever," but UX degrades in the interim.
- **Supabase** — Postgres indexer + service-role queries. Outage breaks reads; on-chain state is the source of truth.

**Mitigations in place:**
- All counterparties are well-funded, audited, and have public SLAs. None of them holds custody of kommitter funds — funds are on-chain; counterparties touch the surrounding UX.
- `RECOVERY.md` covers program-level recovery from upgrade-key compromise.
- Supabase migration 0003 locks privileged Postgres functions to service-role-only EXECUTE (verified with curl probe + PostgreSQL code 42501 / HTTP 401).

### 5. Regulatory risk

Principal-protected yield architectures are not novel and have been tested in court — *Kent v. PoolTogether* was dismissed in 2023 for lack of Article III standing. **The court did not reach the lottery/security merits**, but Judge Block specifically named withdraw-anytime + no defendant-imposed fees as why the plaintiff had no concrete harm — both design properties Kommit ships with. The precedent narrows the regulatory risk but **does not extend automatically to every jurisdiction**, and the underlying merits question remains unresolved.

- **EU / Germany.** MiCA classification of the kommit token (soulbound, non-transferable, no secondary market) is the cleanest jurisdictional read; it sits closer to a non-financial loyalty/membership record than to a security or stablecoin.
- **US.** Howey-test exposure depends on the rights layer at graduation. Allocation rights converted into equity are securities transactions — handled at the launchpad / partner platform layer (CoinList, Buidlpad, Echo, Republic), not by Kommit's program.
- **Disclosure-first design.** Founders publicly disclose their intended raise path before kommitters commit. Universal perks are unconditional; equity allocation rights are conditional on a kommit-compatible path. No surprises, no path-switching after the fact.

**What's still on the table:**
- We are not legal counsel and this doc isn't legal advice.
- Mainnet launch requires a jurisdictional sign-off pass before kommitter onboarding outside the EU dev-cohort.

### 6. Operational / curation risk

v0.5 curation is **admin-only**: a Kommit operator approves which projects appear. This is the moat — quality gate prevents adverse selection — but it's also a single point of decision-making.

- **Adverse selection.** Without curation, low-quality projects flood the platform and dilute signal. Lukas's stance: a quality gate is non-negotiable for early product credibility.
- **Centralization.** Admin curation is by design at v0.5 / v1. v2 explores less-centralized paths (DAO / multisig / staked-reputation).
- **Compromise of the admin keypair** would let an attacker list arbitrary projects. Mitigated by Squads multisig at mainnet.

---

## What kommitters should understand before they commit

Plain-English summary, intended for FAQ surfacing:

1. **Your principal can be withdrawn anytime.** The mechanism for that withdrawal depends on the on-chain Kommit program *and* the underlying yield protocol (Kamino) both operating correctly.
2. **You are not buying equity.** You are parking USDC and earning a soulbound on-chain record (kommits) that may convert to allocation rights at the team's next raise *if* the team raises through a kommit-compatible path. Founders disclose their intended path upfront.
3. **The yield earned on your USDC funds the platform.** It does not flow to the team directly; it does not flow back to you as cash. What flows back to you is the kommit record and the rights it confers.
4. **Smart-contract risk and yield-source risk are non-zero.** No third-party audit on Kommit's program yet; mainnet locked behind one. Kamino is audited but not exploit-immune.
5. **The platform is on devnet today.** Mainnet ship is gated on (a) third-party audit, (b) Squads multisig replacing single-sig admin and upgrade authority, (c) a second yield-source adapter for diversification, (d) jurisdictional sign-off pass.

---

## Where this doc fits

- [SECURITY.md](SECURITY.md) — disclosure flow + severity rubric for vulnerability reports.
- [SECURITY_REVIEW.md](SECURITY_REVIEW.md) — internal Anchor security checklist with file:line citations.
- [RECOVERY.md](RECOVERY.md) — upgrade-authority compromise recovery procedure.
- **This doc** — structural / architectural risk surfaces. Not bugs to fix; tradeoffs to know about.

If you find a way one of the risks named here can fire that we haven't already mitigated to the level we describe, please follow the disclosure flow in [SECURITY.md](SECURITY.md).
