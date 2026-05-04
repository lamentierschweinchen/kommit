# Setup

One-time install. Tested on macOS (Apple Silicon). Current as of May 2026.

## 1. Solana CLI (Anza / Agave)

```bash
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
```

After install, restart shell or `source ~/.zshrc`. Verify:

```bash
solana --version
```

Configure for devnet:

```bash
solana config set --url https://api.devnet.solana.com
solana-keygen new --outfile ~/.config/solana/id.json
solana airdrop 2  # request devnet SOL
```

## 2. Anchor CLI (via avm)

The Anchor repo moved to the Solana Foundation org. Install avm from the new
location, then pin to the version this project targets.

```bash
cargo install --git https://github.com/solana-foundation/anchor avm --force
avm install 0.31.1
avm use 0.31.1
anchor --version  # should print "anchor-cli 0.31.1"
```

We pin to **0.31.1** for v1. We were previously on 0.30.1 but bumped on
2026-05-02 because 0.30.1's IDL builder is broken on modern rustc (anchor-syn
calls `proc_macro::Span::source_file()`, removed in rustc ~1.84). 0.31.x stays
pre-1.0, so adapter targets (Kamino, marginfi, Jupiter Lend) — which still
publish IDLs against pre-1.0 Anchor — remain compatible. Verified by
Codama-rendering Kamino's klend IDL cleanly in the 0.31.1 workspace. See
`/Users/ls/Documents/Kommit/handoffs/02_anchor_idl_toolchain_unblock.md` for
the full diagnosis and coordinator decision.

Anchor 1.0.0 landed in early 2026 with breaking changes (TS package rename
`@coral-xyz/anchor` → `@anchor-lang/core`, stricter `#[derive(Accounts)]`
enforcement, IDL upload default in `anchor deploy`, removal of legacy IDL
instructions). Bumping past 0.31.x is a v1.5 task post-adapter spike, not a
hackathon-deadline task.

If you already have a different Anchor version installed, the `avm use 0.31.1`
line is the one that matters — it does the switch.

## 3. Build the program

```bash
cd app
anchor build
```

First build is slow (compiles dependencies). Subsequent builds are fast.

## 4. Get the real program ID

After the first `anchor build`, get the keypair-derived program ID:

```bash
anchor keys list
```

Replace the placeholder ID (`Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS` —
syntactically valid placeholder, not the real key) in both places:

- `Anchor.toml` (under `[programs.localnet]` and `[programs.devnet]`)
- `programs/kommit/src/lib.rs` (in `declare_id!(...)`)

Then rebuild:

```bash
anchor build
```

## 5. Test

```bash
anchor test
```

Spins up a local validator and runs the TS tests in `tests/`.

## 6. Web app

```bash
cd web
npm install   # if not already done by create-next-app
npm run dev
```

Open `http://localhost:3000`.

## 7. Helius Claude Code Plugin (recommended for agentic dev)

Install the Helius Claude Code Plugin per https://www.helius.dev/blog/helius-for-agents — bundles Helius MCP, DFlow MCP, and the Solana skills (Build / Phantom / DFlow / SVM) for accelerated agent-paired Anchor + frontend development.

Also useful: https://github.com/solana-foundation/solana-dev-skill (Anchor 0.30+ patterns, Codama IDL, Surfpool/LiteSVM testing).

## 8. Off-chain stack — Helius webhook + Supabase indexer + IPFS pinning

The off-chain data layer is in `app/web/src/app/api/webhook/helius/route.ts` (indexer), `app/migrations/supabase/0001_initial_schema.sql` (schema), `app/scripts/pin_project_metadata.ts` + `create_project.ts` (admin tools), and `app/web/src/lib/kommit.ts` (helper library shared by the frontend).

### One-time wiring (Lukas)

1. **Supabase project.** Create a free-tier project at https://supabase.com. Copy URL + anon key + service-role key into `.env.local`. Apply the schema:

   ```bash
   psql "$SUPABASE_DB_URL" -f migrations/supabase/0001_initial_schema.sql
   ```

   (Alternative: paste into the Supabase SQL editor.)

2. **Pinata account.** Create at https://pinata.cloud, generate a JWT, paste into `PINATA_JWT` in `.env.local`.

3. **Helius webhook.** Create one at https://helius.dev/dashboard/webhooks:
   - Type: **Enhanced Transactions**
   - Account/Program: `<NEXT_PUBLIC_KOMMIT_PROGRAM_ID>` (currently `GxM3sxMp4FyrkHK4g1DaDrmwYLrwd2BJKxqKZqvGgkc3`)
   - Webhook URL: `https://<your-vercel-domain>/api/webhook/helius` (or ngrok URL during local dev)
   - Auth header: `Authorization: Bearer <HELIUS_WEBHOOK_SECRET>` — set this same value in `.env.local` as `HELIUS_WEBHOOK_SECRET`. Generate a random token (`openssl rand -hex 32`).

4. **Local dev:** `cd web && npm run dev` then expose with ngrok: `ngrok http 3000`. Use the ngrok URL in the Helius webhook config until you have a real Vercel deployment.

### Per-project workflow (admin)

```bash
# 1. Pin the project's metadata to IPFS.
PINATA_JWT=... npx ts-node scripts/pin_project_metadata.ts ./caldera.json
# → { ipfs_hash: "Qm...", metadata_uri_hash: "0x...", recipient_wallet: "..." }

# 2. Submit the on-chain create_project with the hash.
ANCHOR_WALLET=... ANCHOR_PROVIDER_URL=... npx ts-node scripts/create_project.ts \
  --recipient 5x9... \
  --metadata-uri-hash 0x...

# 3. The Helius webhook fires. The indexer inserts into `projects` table
#    and lazily fetches the IPFS content into `projects.metadata`.
```

### What's blocked on the off-chain stack going live

- Frontend MVP can mock-render dashboards from static seed data, but live dashboards (per-user commitments, per-project supporters, yield receipts) need the indexer reading from Supabase.
- Mainnet deploy is gated on this stack being live (per `handoffs/06_complete_onchain_v1.md` "After this handoff" note).
