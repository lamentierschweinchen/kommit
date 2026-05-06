#!/usr/bin/env bash
# Mainnet deploy for the Kommit program. Idempotent where possible.
#
# Required env (export before running):
#   ANCHOR_WALLET           — path to deployer keypair (mainnet: hardware-wallet
#                             keypair file; devnet dry-run: any funded keypair).
#   ANCHOR_PROVIDER_URL     — RPC endpoint matching CLUSTER. Helius recommended:
#                             https://mainnet.helius-rpc.com/?api-key=$HELIUS_API_KEY
#                             https://devnet.helius-rpc.com/?api-key=$HELIUS_API_KEY
#
# Optional env:
#   CLUSTER                 — anchor cluster alias (default: mainnet). Set to
#                             "devnet" for dry-runs against the devnet program.
#                             The script reads `[programs.<CLUSTER>]` from
#                             Anchor.toml for the ID consistency check.
#                             (Added 2026-05-05 to support dry-run on devnet
#                             before the real mainnet attempt.)
#
# DO NOT RUN against mainnet unilaterally. Coordinator + Lukas gate the real
# deploy — must be paired with frontend MVP demo-able + off-chain indexer live
# + IPFS pinning ready.
#
# After this script: run scripts/bootstrap_mainnet.ts to call initialize_config,
# then create_project for each seed founder via the frontend or a CLI helper,
# then scripts/smoke_mainnet.ts to verify with a small commit-then-withdraw.
#
# UPGRADE AUTHORITY: this script ships the program with whoever ANCHOR_WALLET
# points at as the upgrade authority. v1 fallback is single-sig (the deploy
# keypair). v1.5 plan is to rotate to a Squads multisig — see
# SECURITY_REVIEW.md item 14.3 and SETUP.md "Mainnet deploy" section.
# DO NOT change upgrade authority in this script — coordinator's call.

set -euo pipefail

cd "$(dirname "$0")/.."

CLUSTER="${CLUSTER:-mainnet}"
case "$CLUSTER" in
  mainnet|devnet|testnet|localnet) ;;
  *) echo "ERROR: CLUSTER must be one of mainnet|devnet|testnet|localnet (got: $CLUSTER)"; exit 1 ;;
esac

# --- Preflight -------------------------------------------------------------

[ -n "${ANCHOR_WALLET:-}" ] || { echo "ERROR: ANCHOR_WALLET unset"; exit 1; }
[ -n "${ANCHOR_PROVIDER_URL:-}" ] || { echo "ERROR: ANCHOR_PROVIDER_URL unset"; exit 1; }
[ -f "$ANCHOR_WALLET" ] || { echo "ERROR: ANCHOR_WALLET not a file: $ANCHOR_WALLET"; exit 1; }

if ! command -v anchor >/dev/null; then echo "ERROR: anchor CLI not on PATH"; exit 1; fi
if ! command -v solana >/dev/null; then echo "ERROR: solana CLI not on PATH"; exit 1; fi

DEPLOYER=$(solana address --keypair "$ANCHOR_WALLET")
echo "Cluster          : $CLUSTER"
echo "Deployer wallet  : $DEPLOYER"
echo "Provider URL     : $ANCHOR_PROVIDER_URL"

BALANCE_SOL=$(solana balance "$DEPLOYER" --url "$ANCHOR_PROVIDER_URL" | awk '{print $1}')
echo "Deployer balance : $BALANCE_SOL SOL"
# Anchor 0.31.x program deploys typically cost 3-5 SOL of rent.
awk "BEGIN { exit !($BALANCE_SOL >= 5.0) }" || {
  echo "WARNING: deployer balance < 5 SOL; deploy may fail. Top up first."
}

# --- Build -----------------------------------------------------------------

echo
echo "=== anchor build ==="
anchor build

# --- ID consistency check --------------------------------------------------

DECLARE_ID=$(grep -oE 'declare_id!\("[^"]+"' programs/kommit/src/lib.rs | sed -E 's/declare_id!\("(.+)"/\1/')
ANCHOR_TOML_CLUSTER_ID=$(awk -v section="[programs.$CLUSTER]" '$0 == section {flag=1;next} /^\[/{flag=0} flag && /kommit/' Anchor.toml | grep -oE '"[^"]+"' | tr -d '"')

if [ -z "$ANCHOR_TOML_CLUSTER_ID" ]; then
  echo "ERROR: no [programs.$CLUSTER] section in Anchor.toml"
  exit 1
fi
if [ "$DECLARE_ID" != "$ANCHOR_TOML_CLUSTER_ID" ]; then
  echo "ERROR: declare_id! ($DECLARE_ID) != Anchor.toml [programs.$CLUSTER] ($ANCHOR_TOML_CLUSTER_ID)"
  exit 1
fi
echo "Program ID       : $DECLARE_ID  (matches Anchor.toml [programs.$CLUSTER])"

# --- Idempotency: skip deploy if program is already on-chain at this ID ----

if solana program show "$DECLARE_ID" --url "$ANCHOR_PROVIDER_URL" >/dev/null 2>&1; then
  echo
  echo "Program $DECLARE_ID already exists on $CLUSTER."
  # QA H3: replaced the interactive `read -p` prompt with an explicit env
  # flag so non-interactive runs (CI, agent-driven deploys) don't hang at
  # the riskiest step. Default = abort. Set ALLOW_UPGRADE=true to proceed.
  if [ "${ALLOW_UPGRADE:-false}" != "true" ]; then
    echo
    echo "Aborting. To upgrade in place, re-run with ALLOW_UPGRADE=true:"
    echo "  ALLOW_UPGRADE=true CLUSTER=$CLUSTER ANCHOR_WALLET=... ANCHOR_PROVIDER_URL=... ./scripts/deploy_mainnet.sh"
    exit 1
  fi
  echo "ALLOW_UPGRADE=true — proceeding with in-place upgrade."
fi

# --- Deploy ----------------------------------------------------------------

echo
echo "=== anchor deploy --provider.cluster $CLUSTER ==="
anchor deploy --provider.cluster "$CLUSTER"

# --- IDL upload ------------------------------------------------------------

echo
echo "=== anchor idl init / upgrade ==="
if anchor idl fetch --provider.cluster "$CLUSTER" "$DECLARE_ID" >/dev/null 2>&1; then
  echo "On-chain IDL already exists; upgrading."
  anchor idl upgrade \
    --provider.cluster "$CLUSTER" \
    --filepath target/idl/kommit.json \
    "$DECLARE_ID"
else
  echo "No on-chain IDL; initializing."
  anchor idl init \
    --provider.cluster "$CLUSTER" \
    --filepath target/idl/kommit.json \
    "$DECLARE_ID"
fi

# --- Final state ------------------------------------------------------------

echo
echo "=== Deploy success ==="
echo "Program ID        : $DECLARE_ID"
solana program show "$DECLARE_ID" --url "$ANCHOR_PROVIDER_URL" | head -10
NEW_BALANCE=$(solana balance "$DEPLOYER" --url "$ANCHOR_PROVIDER_URL" | awk '{print $1}')
echo "Deployer balance  : $NEW_BALANCE SOL  (started $BALANCE_SOL SOL)"
echo
echo "Next steps:"
echo "  1. ANCHOR_WALLET=... ANCHOR_PROVIDER_URL=... npx ts-node scripts/bootstrap_mainnet.ts"
echo "  2. Create seed projects via the frontend or a small CLI helper."
echo "  3. ANCHOR_WALLET=... ANCHOR_PROVIDER_URL=... npx ts-node scripts/smoke_mainnet.ts <PROJECT_PDA>"
