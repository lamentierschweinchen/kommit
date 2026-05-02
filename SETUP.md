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
avm install 0.30.1
avm use 0.30.1
anchor --version  # should print "anchor-cli 0.30.1"
```

We pin to **0.30.1** intentionally for v1. Anchor 1.0.0 landed in early 2026
with breaking changes (TS package rename `@coral-xyz/anchor` →
`@anchor-lang/core`, stricter `#[derive(Accounts)]` enforcement, IDL upload
default in `anchor deploy`, removal of legacy IDL instructions). Several
mainstream Solana DeFi programs and their IDLs (Kamino, marginfi, Jupiter
Lend) still publish against pre-1.0 Anchor as of this writing. Bumping is a
v1.5 task post-adapter spike, not a hackathon-deadline task.

If you already have a different Anchor version installed, the `avm use 0.30.1`
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
