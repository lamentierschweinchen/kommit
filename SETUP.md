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

## 4. Confirm the program ID

The real program ID is already committed throughout the repo
(`GxM3sxMp4FyrkHK4g1DaDrmwYLrwd2BJKxqKZqvGgkc3`) — both `declare_id!` in
`programs/kommit/src/lib.rs` and every `[programs.*]` entry in
`Anchor.toml`. New contributors do **not** need to swap a placeholder. To
confirm `anchor build` derived the same key from the local keypair:

```bash
anchor keys list   # should print: kommit: GxM3sxMp4FyrkHK4g1DaDrmwYLrwd2BJKxqKZqvGgkc3
```

If `anchor keys list` returns a different ID, the program keypair on this
machine doesn't match the committed `declare_id!`. That's a fresh-machine
fixup — flag to Lukas before deploying anywhere.

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

# 3. The Helius webhook fires. The indexer inserts the project row using
#    the metadata_uri_hash carried on the ProjectCreated event payload
#    (QA H1, 2026-05-05). A separate sweeper pulls the IPFS blob into
#    `projects.metadata` on demand.
```

### What's blocked on the off-chain stack going live

- Frontend MVP can mock-render dashboards from static seed data, but live dashboards (per-user commitments, per-project supporters, yield receipts) need the indexer reading from Supabase.
- Mainnet deploy is gated on this stack being live (per `handoffs/06_complete_onchain_v1.md` "After this handoff" note).

## 9. Mainnet deploy (gated — coordinator + Lukas trigger)

Deploy artifacts:

- `scripts/deploy_mainnet.sh` — `anchor build` + ID consistency check + `anchor deploy --provider.cluster mainnet` + `anchor idl init/upgrade`. Idempotent: prompts before upgrading an existing on-chain program at the same ID.
- `scripts/bootstrap_mainnet.ts` — calls `initialize_config` once. Idempotent: no-op if config already initialized.
- `scripts/smoke_mainnet.ts <PROJECT_PDA>` — small-amount end-to-end smoke once a project is created.

Required env:

```bash
export ANCHOR_WALLET=~/.config/solana/mainnet-deployer.json
export ANCHOR_PROVIDER_URL="https://mainnet.helius-rpc.com/?api-key=$HELIUS_API_KEY"
```

Run order:

```bash
./scripts/deploy_mainnet.sh
ANCHOR_WALLET=... ANCHOR_PROVIDER_URL=... npx ts-node scripts/bootstrap_mainnet.ts
# (admin creates seed projects via the frontend or a small CLI helper)
ANCHOR_WALLET=... ANCHOR_PROVIDER_URL=... npx ts-node scripts/smoke_mainnet.ts <PROJECT_PDA>
```

### Dry-run on devnet first

Before the actual mainnet attempt, run the same scripts against devnet to
catch script bugs early:

```bash
CLUSTER=devnet \
  ANCHOR_WALLET=$HOME/.config/solana/id.json \
  ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
  ./scripts/deploy_mainnet.sh

ANCHOR_WALLET=$HOME/.config/solana/id.json \
  ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
  npx ts-node --transpile-only scripts/bootstrap_mainnet.ts
```

The `CLUSTER=devnet` env override flips the deploy script's
`--provider.cluster` flag and ID-consistency check to use
`[programs.devnet]` from `Anchor.toml` (added 2026-05-05). Both scripts
are idempotent — if the program is already deployed and config
initialized on devnet (which they are, post-handoff-06 spike merge),
the scripts detect that and exit cleanly without re-spending SOL.

Use `--transpile-only` on `ts-node` to skip Anchor 0.31's strict-types
account-resolution checks; the runtime path still validates everything
on-chain.

### Upgrade authority — v1 single-sig (deferred decision)

The deploy script ships the program with whoever `ANCHOR_WALLET` points
at as the upgrade authority. v1 fallback is **single-sig** (the deploy
keypair, typically Lukas's hardware wallet for the initial private-beta
cohort).

This is the **only v1 risk that lets a key compromise drain user funds**
(see [`SECURITY_REVIEW.md`](SECURITY_REVIEW.md) item 14.3): a malicious
program upgrade can rewrite `withdraw` to transfer to the attacker.
Mitigation in v1: do not announce the program ID publicly until upgrade
authority is multisig'd.

**v1.5 plan**: rotate upgrade authority to a Squads multisig (3-of-5 or
similar). Coordinator's call when Lukas is back from his trip and Sean's
Squads-integration response is in. The `deploy_mainnet.sh` script
intentionally does NOT rotate the upgrade authority — this is a manual
post-deploy step:

```bash
solana program set-upgrade-authority \
  --program-id <PROGRAM_ID> \
  --new-upgrade-authority <SQUADS_MULTISIG_ADDRESS> \
  --upgrade-authority $ANCHOR_WALLET \
  --url $ANCHOR_PROVIDER_URL
```

Rotate `config.admin` to the same Squads multisig at the same time
(item 14.2 in SECURITY_REVIEW.md). The admin can pause / curate /
rotate metadata but cannot move funds.

## 10. Dependency audit (pre-mainnet, 2026-05-05)

Walk-through of the workspace's pinning + known-issue posture. Run before
each mainnet attempt; doc this section if anything shifts. **No changes
applied to dep versions in this audit pass — recommendations only,
locked-decision territory needs coordinator review.**

### Locked + working

- **Anchor 0.31.1.** `programs/kommit/Cargo.toml` exact-pinned. `web/package.json`
  exact-pinned. `app/package.json` is `^0.31.1` (caret allows 0.31.x patches).
  Confirmed working on rustc 1.93 + cargo 1.93. The earlier 0.30.1 IDL-build
  break is fully resolved.
- **proc-macro2 1.0.106.** Was the source of the earlier `Span::source_file`
  fail under anchor 0.30.1; harmless under 0.31.x.
- **solana-program 2.3.0** transitive via anchor-spl. Aligned with the
  Solana CLI 3.1.14 we deploy with.
- **@solana/web3.js 1.98.4.** Legacy Solana JS SDK. Compatible with
  `@coral-xyz/anchor 0.31.x`. The newer `@solana/kit` is NOT used (frontend +
  indexer + scripts all on web3.js v1; consistent).
- **@privy-io/react-auth 3.23.1, @supabase/supabase-js 2.105.1, next 16.2.4,
  react 19.2.4, eslint-config-next 16.2.4** — all exact-pinned in
  `web/package.json`. Good hygiene.

### Recommendations (not applied — surface to coordinator)

- **`app/package.json` `@coral-xyz/anchor: "^0.31.1"` → exact `0.31.1`.**
  Asymmetric with `web/package.json` and `programs/kommit/Cargo.toml`. Caret
  here means `yarn install` could pull a patch we haven't tested. Tightening
  to exact prevents drift across re-installs.
- **`web/package.json` `tailwindcss: "^4"` and `@tailwindcss/postcss: "^4"`.**
  Tailwind v4 is still relatively young; broad caret can pull breaking changes.
  Pin to a specific 4.x patch.
- **`shadcn: "4.6.0"` in `web/package.json` `dependencies`.** `shadcn` is
  normally consumed via CLI (`npx shadcn add ...`), not as a runtime dep —
  verify whether the frontend actually imports anything from it; if not, move
  to `devDependencies` or drop.

### Known harmless warnings

- **`#[program]` macro emits a `realloc` deprecation warning.** Anchor 0.31.1's
  internal codegen still uses `AccountInfo::realloc` (deprecated in favor of
  `AccountInfo::resize`). Will be resolved when Anchor 1.0+ lands; deferred to
  v1.5 per the build_order.md lock.
- **17 `unexpected cfg` warnings** about `custom-heap`, `custom-panic`,
  `anchor-debug`. Anchor's macros reference cfg flags that the compiler doesn't
  know about. Cosmetic; no fix needed.

### Init-if-needed safety note

`programs/kommit/Cargo.toml` enables anchor-lang's `init-if-needed` feature.
Re-init attacks are a real risk with this feature when the seeds are
attacker-controllable AND the handler doesn't validate existing state.
**Verified safe in our usage** — every `init_if_needed` PDA's seeds include
either the user's pubkey (Commitment) or program-deterministic constants
(escrow, collateral, lending_position, harvest_landing). The `commit` handler
explicitly distinguishes "fresh" vs "existing" via `commitment.principal == 0
&& commitment.user == Pubkey::default()` before treating as new (see
`programs/kommit/src/instructions/commit.rs:71-75`).

### Cargo.lock multi-version notes

Three concurrent versions of `block-buffer` (0.9.0, 0.10.4, 0.12.0), `digest`
(0.9.0, 0.10.7, 0.11.2), `borsh` (0.10.4, 1.6.1) — all transitive. Normal for
the Solana SDK transitive graph, not actionable. Don't try to dedupe; doing so
would force-update something downstream.
