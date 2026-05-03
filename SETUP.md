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

## 8. Mainnet deploy (gated — coordinator + Lukas trigger)

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
