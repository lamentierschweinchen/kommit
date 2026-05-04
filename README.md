# Kommit

A Solana primitive for early-stage validation. Users park USDC; principal stays theirs in escrow; yield routes to a curated project's wallet; users earn soulbound on-chain reputation (capital × time, active + lifetime split). The platform issues no token, ever.

Built for the Solana Frontier hackathon (May 2026). Open-source from commit 1.

## Status

Pre-MVP scaffolding. Anchor workspace + Next.js web app; instructions and frontend being built layer by layer per `../build_order.md`.

## Repo layout

```
app/
├── programs/kommit/    # Anchor program (Rust)
│   └── src/
│       ├── lib.rs
│       ├── state.rs
│       ├── errors.rs
│       └── instructions/
├── tests/              # TS integration tests (anchor-mocha)
├── migrations/         # Anchor deploy scripts
├── web/                # Next.js 14 frontend (TypeScript + Tailwind + shadcn/ui)
├── Anchor.toml
├── Cargo.toml          # Rust workspace
└── SETUP.md            # one-time install + first-run instructions
```

## Architecture (one-liner)

USDC committed → Anchor program escrow → CPI to a Solana lending market (Kamino / marginfi / Jupiter Lend / Squads-Altitude — yield-source-agnostic via `YieldSource` trait) → yield streams to project wallet → committer accrues soulbound `active_score` + `lifetime_score` → withdraw principal anytime.

See `../build_order.md` (build sequence + cut order), `../program_spec.md` (Anchor API), `../design.md` (UX + wireframes).

## Develop

See [`SETUP.md`](SETUP.md) for first-time install. Then:

```bash
# Anchor program
anchor build
anchor test

# Web app
cd web
npm run dev
```

## Deploy

Mainnet deploy artifacts under [`scripts/`](scripts/):

- [`scripts/deploy_mainnet.sh`](scripts/deploy_mainnet.sh) — one-shot mainnet deploy (program + IDL upload).
- [`scripts/bootstrap_mainnet.ts`](scripts/bootstrap_mainnet.ts) — calls `initialize_config` post-deploy.
- [`scripts/smoke_mainnet.ts`](scripts/smoke_mainnet.ts) — small-amount end-to-end smoke once a project is live.
- [`scripts/smoke_klend_devnet.ts`](scripts/smoke_klend_devnet.ts) — devnet round-trip against the live klend USDC market.

Required env vars are documented in [`.env.example`](.env.example).

## Security

[`SECURITY_REVIEW.md`](SECURITY_REVIEW.md) — self-audit pass against the Anchor security checklist (14 items + verdict). Hackathon-private-beta-grade. Re-run before mainnet deploy.

## License

MIT (see `LICENSE`).
