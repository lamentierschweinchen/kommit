# Kommit

**A conviction primitive for early-stage backing on Solana.** You park your money. The interest it earns funds the platform sustainably — no fees on you, no fees on the team. You allocate that money across early-stage teams you want to back. Withdraw anytime; your money stays yours. What you earn is a record: **kommits** — capital × time committed, soulbound, public, verifiable. They prove you showed up early. Other products can read them. When a team raises, kommitters with earned standing get first dibs to invest.

Built for the [Solana Frontier hackathon](https://solana.com/frontier) (May 2026). MIT-licensed and open-source from commit 1.

> ⚠️ **Hackathon / devnet-grade — not production-ready.** This codebase is submitted to Solana Frontier and currently runs on **Solana devnet only**. It has **not been independently audited**. Mainnet deploy artifacts exist (`scripts/deploy_mainnet.sh`) but the button has not been pressed; mainnet is whenever-if-ever. Don't put real money you can't afford to lose into anything here.
>
> See [`SECURITY.md`](SECURITY.md) for disclosure path and known limitations, [`SECURITY_REVIEW.md`](SECURITY_REVIEW.md) for the internal Anchor program audit, and [`RECOVERY.md`](RECOVERY.md) for program-upgrade-keypair recovery.

**Live demo:** [kommit-lilac.vercel.app](https://kommit-lilac.vercel.app) (devnet)

---

## What it does

The category Kommit invents: **a stake-backed signal layer for early-stage teams.** Real money, real opportunity cost, real signal — without principal extraction.

Existing "early supporter" mechanisms fail at one of two things:

- **Signal without stake** — Product Hunt upvotes, Twitter likes, follower counts. Gameable, no opportunity cost.
- **Stake without survival** — equity crowdfunding (Wefunder, Republic, Crowdcube). Real money, but principal loss for backers; high friction.

Kommit's signal is **stake-backed and survival-compatible**. Real money committed for real time, with real opportunity cost (the yield you'd have earned by parking that money anywhere else). Hard to game: wash-trading volume doesn't work when the input is patient capital tied up over time. Easy to verify: public, soulbound, on-chain.

**For backers ("kommitters"):** Park money. Allocate across teams you want to back. Withdraw anytime, no fees. Earn a verifiable record that compounds.

**For teams:** Demand validation that's cleaner than upvotes and faster than waiting for revenue. Pre-validated cohort of named, capital-committed early backers. Onboard without paying fees or diluting equity.

**For the ecosystem:** A composable, sybil-resistant cohort signal that any other product can read on-chain.

---

## Sample flow

```
Kommitter parks $100 on Kommit, allocates it to project X.
  → $100 in per-project escrow PDA (still kommitter's)
  → CPI deposit to klend's USDC reserve
  → cTokens minted to per-project collateral PDA
  → Kommit accrues capital × time on-chain (u128 active_score + lifetime_score)

Time passes. Kommits grow continuously while capital stays committed.

Project graduates to a real round (or doesn't).
  → If it graduates through Kommit, kommitters with earned standing get first
    dibs to invest at round price (right of first allocation).
  → Either way, kommitters keep their money + their kommits as a portable
    record of conviction. Other products can read kommit balances on-chain.

Kommitter withdraws anytime:
  → Layer-1 path (escrow has enough): direct transfer escrow → kommitter
  → Layer-2 path (escrow insufficient): klend redeem first, then transfer
  → Money returns to kommitter's wallet
  → active_score zeroed; lifetime_score preserved
```

---

## Architecture

```mermaid
flowchart LR
    subgraph User["Kommitter (browser)"]
        Frontend["Next.js 15 + React 19<br/>+ Tailwind v3 + Radix<br/>+ Privy embedded wallet<br/>+ Anchor TS client"]
    end

    subgraph OnChain["Solana program (devnet)"]
        Kommit["Kommit Anchor program<br/>10 instructions<br/>5 PDAs"]
        Klend["Kamino klend<br/>(YieldSource adapter v1)"]
        Kommit -- "supply / redeem<br/>(CPI, hand-rolled)" --> Klend
    end

    subgraph OffChain["Off-chain stack"]
        Helius["Helius<br/>Enhanced Tx webhook"]
        Indexer["Next.js Route Handler<br/>(EventParser → Supabase)"]
        Supabase["Supabase Postgres<br/>events + materialized views"]
        IPFS["Pinata IPFS<br/>(project metadata)"]
        Helius -- "tx logs" --> Indexer
        Indexer --> Supabase
    end

    Frontend -- "user signs tx" --> Kommit
    Kommit -- "events" --> Helius
    Frontend -- "reads dashboards" --> Supabase
    Frontend -- "fetch metadata" --> IPFS
```

**On-chain / off-chain split:**

| Feature | Where | Why |
|---|---|---|
| Money escrow + redemption | On-chain | Asset itself; trust-critical |
| Yield routing (CPI) | On-chain | Programmable, composable, verifiable |
| Kommits accrual (capital × time) | On-chain | Verifiability is the whole thesis |
| Project metadata | Hybrid | IPFS pin + on-chain `metadata_uri_hash` |
| Project updates / posts | Off-chain | Postgres |
| Curation (which projects appear) | Off-chain | Centralized admin in v1; less-centralized paths in v2 |
| Indexing / dashboards | Off-chain | Helius webhook → Supabase materialized views |

---

## Status

**v0.5 — primitive feature-complete on devnet.** End-to-end klend round-trip verified; QA Codex SHIP-CLEAN on `fix/qa-criticals` (merged); 30/30 anchor TS tests + 8/8 Rust unit tests + 3/3 webhook fixture tests passing. Fiat rails (card / SEPA / bank) are the v1 architectural milestone — see scope section below.

**Frontend is wired live on devnet.** Real Privy auth (passkey + Google + email), real Anchor program reads, real on-chain commit/withdraw against the deployed program. Indexer reads through Supabase. Mock data fallback for surfaces where indexer hasn't materialized.

**Verified end-to-end on devnet** (full klend round-trip from merge commit [`7fd0965`](https://github.com/lamentierschweinchen/kommit/commit/7fd0965)):

| Step | Tx |
|---|---|
| `create_project` | [`LMRdECdG2WR2kK4...3as3`](https://solscan.io/tx/LMRdECdG2WR2kK4NQoA9Hn4ZDubxJSp7Zo4Sv6YCmBbHyCFkFh9ZB5FnrToTNyx449zKgMyzuffmtkcrYx33as3?cluster=devnet) |
| `commit` (0.1 USDC) | [`4eVns1cRvi5k3SAb...wPaK`](https://solscan.io/tx/4eVns1cRvi5k3SAbSDRqD3mQiN7DZRZDFFjdf2oKiWZwxPa8xuX8iNjjS6QPGz5ipsr3kckk5Yt26Pc6LFotwPaK?cluster=devnet) |
| `supply_to_yield_source` | [`3W3NLShGu4LdCN7n...NSED`](https://solscan.io/tx/3W3NLShGu4LdCN7nM7RfG4rhx9twwJnua9E3G7szwy6xznLMsWk5ZJnp3xtnLrdaMBkz5M8ri9MSvvv5Q3CfNSED?cluster=devnet) |
| `harvest` | [`MtMMPBZSwwNWtNMo...mxXAu`](https://solscan.io/tx/MtMMPBZSwwNWtNMovFwu5QRvfKX3JZPQ5KUj8p3GJd55FtnS5myoUxYS55BdiHBhS6rfvEe4NSqBFYFJwbmxXAu?cluster=devnet) |

**Devnet program ID:** `GxM3sxMp4FyrkHK4g1DaDrmwYLrwd2BJKxqKZqvGgkc3` (same address reserved for eventual mainnet).

---

## Repo layout

```
app/
├── programs/kommit/             # Anchor program (Rust, Anchor 0.31.1)
│   └── src/
│       ├── lib.rs               # Program entry point (10 instructions)
│       ├── state.rs             # 5 PDAs (KommitConfig, Project, Commitment,
│       │                        #   LendingPosition, KaminoAdapterConfig)
│       ├── errors.rs
│       ├── events.rs            # 7 events
│       ├── adapters/kamino.rs   # Hand-rolled klend CPI + ReserveSnapshot math
│       └── instructions/        # One file per instruction
├── tests/                       # 30 Anchor TS integration tests + 8 Rust unit tests
├── scripts/                     # Deploy + smoke + IPFS pin + create_project utilities
├── migrations/
│   └── supabase/                # Indexer schema (0001 + 0002)
├── web/                         # Next.js 15 + React 19 frontend (App Router)
│   └── src/
│       ├── app/                 # Routes: /, /projects, /dashboard, /founder, /account, /build, /about
│       ├── components/          # Brutalist primitives + auth + commit/withdraw + dashboard
│       ├── lib/
│       │   ├── kommit.ts        # PDA derivation + program ID constants
│       │   ├── anchor-client.ts # Privy → Anchor wallet adapter, useKommitProgram hook
│       │   ├── tx.ts            # commit / withdraw transaction builders
│       │   ├── queries.ts       # Read-side facade (mock / Anchor / indexer 3-source swap)
│       │   ├── anchor-errors.ts # User-safe RPC/Anchor error mapping
│       │   ├── money.ts         # Decimal-safe bigint helpers (parseTokenAmount, validateAmount)
│       │   ├── kommit-math.ts   # Demo math (USD × days held = kommits)
│       │   └── idl/             # Bundled IDL JSON + TS types
│       └── app/api/webhook/helius/route.ts  # Indexer
├── idls/kamino_lending.json     # Reference: converted klend mainnet IDL
├── Anchor.toml                  # [programs.localnet|devnet|mainnet] all set to keypair-derived ID
├── Cargo.toml
├── SECURITY.md                  # Disclosure policy + scope + severity rubric
├── SECURITY_REVIEW.md           # 14-item internal Anchor self-audit
├── RECOVERY.md                  # Program upgrade authority keypair recovery procedure
└── SETUP.md                     # First-time install + env var template
```

---

## Develop

See [`SETUP.md`](SETUP.md) for first-time install. Then:

```bash
# Anchor program
anchor build
anchor test                      # 30 TS tests + 8 Rust unit tests on a local validator

# Web app
cd web
cp .env.example .env.local       # fill in Privy / Helius / Supabase / Pinata keys
npm install
npm run dev                      # http://localhost:3000
```

Required env vars are documented in [`web/.env.example`](web/.env.example) and [`.env.example`](.env.example). The web app falls back to mock data when keys aren't set, so design review and click-through walks work without provisioning external services.

---

## Deploy

**Devnet** is the v0.5 target for hackathon submission. The program is already deployed at `GxM3sxMp4FyrkHK4g1DaDrmwYLrwd2BJKxqKZqvGgkc3`.

**Mainnet artifacts** under [`scripts/`](scripts/) exist and are tested but not yet executed in production:

- [`scripts/deploy_mainnet.sh`](scripts/deploy_mainnet.sh) — preflight + idempotent `anchor deploy` + IDL init/upgrade. Supports `CLUSTER=devnet` for dry-runs.
- [`scripts/bootstrap_mainnet.ts`](scripts/bootstrap_mainnet.ts) — idempotent `initialize_config` call.
- [`scripts/smoke_mainnet.ts`](scripts/smoke_mainnet.ts) — small commit→accrue→withdraw round-trip once a seed project is created.
- [`scripts/smoke_klend_devnet.ts`](scripts/smoke_klend_devnet.ts) — devnet round-trip with the live klend USDC market.

Mainnet is gated on independent third-party audit + Squads multisig migration of admin + program upgrade authority.

---

## v0.5 / v1 / v2 scope

**v0.5 (this submission, devnet — today):**
- 11 instructions: `initialize_config`, `create_project`, `commit`, `withdraw`, `accrue_points`, `supply_to_yield_source`, `harvest`, `admin_pause`, `admin_unpause`, `admin_update_project_metadata`, `initialize_kamino_adapter_config`
- One yield-source adapter (Kamino klend USDC reserve)
- Single-sig admin + single-sig program upgrade authority (project lead's keypair)
- USDC entry, Solana wallet entry — Solana-fluent users only at this layer
- Demo faucet UX (Circle devnet USDC + Solana devnet SOL airdrop) so evaluators can walk the flow without prep
- Off-chain stack: Helius → Supabase indexer; Pinata for IPFS; Privy for embedded-wallet auth (passkey + email + Google)
- Frontend: 10 routes — landing, browse, project detail, kommitter dashboard, founder dashboard, account, build (founder application), about

**v1 (post-submission, ~1-2 weeks — fiat rails, retail-frictionless):**
- **Card → USDC on Solana** via Privy's built-in [MoonPay](https://www.moonpay.com/business/onramp) and [Coinbase Pay](https://www.coinbase.com/onramp) — both first-class config flips in `@privy-io/react-auth`. ~5-min onboarding. The user enters their card, kommits; USDC under the hood.
- **SEPA → USDC** for EU users via [Helio](https://hel.io) or [Mercuryo](https://mercuryo.io) — Solana-native SDKs.
- **Off-ramps** via the same partner network (card-back / SEPA-back depending on entry rail).
- Squads V4 multisig governance for `KommitConfig.admin` + program upgrade authority (zero program-side change; vault PDA signs via `invoke_signed`)
- Squads smart-account project recipient wallets (sub-30s stand-up via `multisigCreateV2`)
- Second yield-source adapter (marginfi or Jupiter Lend)
- `admin_update_project_recipient` instruction for recipient rotation
- Founder application admin queue (currently invite-only)
- Earned-allocation-rights flow at graduation (kommitters with `lifetime_score` ≥ threshold get first dibs at the team's next round)
- Public-named display opt-in for kommitters
- Cross-chain commit via LI.FI bridge integration

**v2 (with Visa partnership — invisible-tech retail rails):**
- User enters their Visa card and a kommit amount in their local currency. Crypto vocabulary disappears entirely from the user surface — *the tech is invisible*. The technical rail under the hood: **Visa's USDC settlement on Solana** ($7B+ annualized run-rate per [CoinDesk April 2026](https://www.coindesk.com/business/2026/04/29/visa-expands-stablecoin-settlement-network-as-volume-hits-usd7-billion-run-rate)). Visa moves money in fiat; settlement clears in USDC on Solana inside Kommit's program. The user sees their card statement.
- This is the layer Visa is the *natural named partner for* — no other entity can deliver it as cleanly.
- Engineering: a partnership conversation, not a sprint. Architectural commitment locked now; ship date follows the partnership.

**v2+ (post-traction):**
- `create_graduation_attestation` PDAs + graduation flow
- Composable points-reading API consumer integrations (other Solana protocols gating access on `lifetime_score`)
- Cohort SaaS — anonymized, opt-in cohort intelligence sold to launchpads / VCs / adjacent protocols
- Less-centralized curation (DAO / multisig / staked-reputation)
- Mainnet — gated on third-party audit + Squads multisig in place + the v1 fiat-rails layer being live

**Hard locks (never reopened):**
- No platform token. Ever.
- No fees on kommitters or founders.
- Kommitter principal stays redeemable, withdraw anytime, no cooldown.
- Soulbound on-chain reputation (kommits) — non-transferable by construction.

---

## Security

- [`SECURITY.md`](SECURITY.md) — disclosure email, in/out-of-scope, severity rubric.
- [`SECURITY_REVIEW.md`](SECURITY_REVIEW.md) — internal 14-item Anchor security checklist with file:line citations and named test verifications.
- [`RECOVERY.md`](RECOVERY.md) — program upgrade authority keypair recovery procedure (no secrets in the doc).

QA history:

- **Codex Pass 1** (initial security review) — 4 critical findings, fix-pass-1 + fix-pass-2 cycles.
- **Codex Pass 2** (verification) — `fix/qa-criticals` SHIP-CLEAN at HEAD `f4d87d7`. C1 v2 fee-field math matches `klend-sdk`'s `getTotalSupply()` semantics; H2/M2/C2/C3/C4 test gaps closed.
- **Full-stack security hardening pass** — see SECURITY_HARDENING.md (workspace-level, not in repo). Verdict: HOLD-WITH-FIXES at time of writing; tracked findings burning down.

Pre-scaling upgrades called out explicitly: multisig admin + multisig upgrade authority + third-party audit before any meaningful mainnet deploy.

---

## License

MIT — see [`LICENSE`](LICENSE).
