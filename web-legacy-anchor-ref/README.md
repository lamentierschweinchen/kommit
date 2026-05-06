# Kommit — web

Next.js 16 app. Five canonical routes (`/`, `/projects`, `/projects/[slug]`,
`/dashboard`, `/founder/[slug]`) plus a visual prototype at `/proto` for
design review. shadcn/ui (Radix + Nova preset) on Slate defaults.
Privy embedded wallet for Solana + Anchor TS client for tx construction.

## Quickstart

```bash
cd app/web
npm install
npm run dev
```

Open <http://localhost:3000>. Browse renders against mock data with no
external services required.

`npm run build` for a production build (~5s, 20 routes).

## Three data sources, two env flags

Reads flow through `src/lib/queries.ts`. Same function signatures across
all sources — screens don't know which one they're hitting.

| Source     | When                                | Reads from                                |
| ---------- | ----------------------------------- | ----------------------------------------- |
| `mock`     | default                             | `src/lib/mock-data.ts` fixtures           |
| `anchor`   | `NEXT_PUBLIC_USE_MOCK_DATA=false`   | on-chain `program.account.*` via RPC      |
| `indexer`  | `NEXT_PUBLIC_USE_INDEXER=true`      | Supabase `project_dashboard` / `user_dashboard` views |

`indexer` wins when both are set. The default keeps the demo working without
any external service.

### Mode prerequisites

| Mode      | Needs                                                                              |
| --------- | ---------------------------------------------------------------------------------- |
| `mock`    | nothing — fixtures live in the repo                                                |
| `anchor`  | `NEXT_PUBLIC_HELIUS_RPC_URL` (or default devnet); program deployed to that cluster; hand-seeded projects on-chain |
| `indexer` | the above, plus `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`; webhook running and caught up |

In `anchor` and `indexer` modes, the slug ↔ project mapping still flows
through `src/lib/mock-data.ts` (the v1 hand-seeded "off-chain projects table").
On-chain `Project` PDAs lack name/pitch/founders — that lives in IPFS metadata
or the Supabase `projects.metadata` jsonb column. Until IPFS pinning is fully
end-to-end, the seed list provides display data.

## Privy — wallet sign-in

Set `NEXT_PUBLIC_PRIVY_APP_ID` in `.env.local` to enable real sign-in.
Without it, the dashboard renders against mock data and an amber banner
warns that sign-in attempts will fail.

`PrivyProvider` is wrapped in `src/components/providers-mount.tsx` with
`next/dynamic({ ssr: false })`. Privy rejects placeholder app IDs at init
which would otherwise break SSG of `/_not-found`. Brief flash on first
paint is acceptable for v1; revisit when a real app ID is in `.env.local`.

## Anchor IDL

Bundled at `src/lib/idl/kommit.{json,ts}`. Regenerated via `anchor build`
at the workspace root and synced into this directory. The frontend reads
it via `import idl from '@/lib/idl/kommit.json'` and `import type { Kommit }
from '@/lib/idl/kommit'`.

`useKommitProgram()` (in `src/lib/anchor-client.ts`) constructs a
`Program<Kommit>` from the IDL plus a Privy-wallet-backed `AnchorProvider`.
It returns `null` until a wallet is connected.

For read-only queries (browse, project detail), `lib/queries.ts` builds its
own provider with a dummy wallet — no signing capability, but `program.account.*`
fetches work fine.

## Commit + withdraw

`src/lib/tx.ts`:

- `commitToProject(client, recipientWallet, amountDollars)` — wraps
  `program.methods.commit(amount).accountsPartial({...}).rpc()`. Derives
  user's USDC ATA + escrow PDA + commitment PDA + config PDA.
- `withdrawFromProject(client, recipientWallet, amountDollars)` — same
  shape; passes `redeem_collateral_amount = 0` (escrow-only path).

Devnet USDC mint is hardcoded as `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
(Circle faucet-mintable). Mainnet swap is one constant change.

**v1 caveat:** withdraws don't yet handle the klend redeem path. When
`supply_to_yield_source` has moved funds from escrow to klend, withdraws
need the 14-account klend graph passed via `remaining_accounts`. Private
beta avoids this by not auto-supplying — keep funds in escrow until the
v1.5 redeem path lands here.

## Routes

| Path                  | What                                       | Server / Client          |
| --------------------- | ------------------------------------------ | ------------------------ |
| `/`                   | landing — rotating hero, how-it-works, featured teams, FAQ | server                   |
| `/projects`           | browse grid                                | server                   |
| `/projects/[slug]`    | project detail + Commit/Withdraw modals    | server (data) + client (modals) |
| `/dashboard`          | committer view — Privy-gated              | client (needs wallet)    |
| `/founder/[slug]`     | founder view — supporters + receipts      | server (data) + client (post update) |
| `/proto`              | preserved monolithic visual prototype      | server                   |
| `/api/webhook/helius` | indexer webhook handler (engineer's track) | dynamic                  |

## Component primitives

`src/components/kommit/`:

- `project-card`, `team-header` — display surfaces
- `commit-modal`, `withdraw-modal` — sign in user's wallet, sonner toasts on success/failure
- `points-display` — quiet number + label, no badge or sparkle
- `yield-routed-display` — $ to a named team, not %APY
- `committer-list` — founder dashboard supporter table
- `hero-rotating-word` — landing animator
- `connect-wallet`, `role-switcher` — Privy login + "Switch to founder view" if user owns a project
- `site-header` / `site-footer` — collapses to `Sheet` on mobile

## Env reference

Copy `app/.env.example` to `app/web/.env.local` and fill what you need.

| Var                                | Required for | Default                              |
| ---------------------------------- | ------------ | ------------------------------------ |
| `NEXT_PUBLIC_KOMMIT_PROGRAM_ID`    | anchor mode  | `GxM3sxMp4FyrkHK4g1DaDrmwYLrwd2BJKxqKZqvGgkc3` |
| `NEXT_PUBLIC_HELIUS_RPC_URL`       | anchor mode  | `https://api.devnet.solana.com`      |
| `NEXT_PUBLIC_PRIVY_APP_ID`         | sign-in      | placeholder (banner shows)           |
| `NEXT_PUBLIC_SUPABASE_URL`         | indexer mode | —                                    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`    | indexer mode | —                                    |
| `NEXT_PUBLIC_USE_MOCK_DATA`        | source flag  | `true` (set `false` to use Anchor)   |
| `NEXT_PUBLIC_USE_INDEXER`          | source flag  | `false` (set `true` to use Supabase) |

## Notes

- `.npmrc` pins `legacy-peer-deps=true` — Privy + `@solana-program/memo` peer
  range conflict on `@solana/kit` (5 vs 6). Without it, `npm install` fails.
- Multi-lockfile workspace warning in `next build` is harmless. Set
  `turbopack.root` in `next.config.ts` to silence.
- `anchor` mode supports browse + project detail + dashboard list, but the
  per-commitment "weekly yield routed" and yield receipts need harvest event
  history — anchor reads can't provide that without scraping tx logs. Those
  fields stay at mock placeholders in `anchor` mode; live in `indexer` mode.
