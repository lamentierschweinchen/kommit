/**
 * One-shot setup for the Lane B sandbox SPL mint.
 *
 * Creates a devnet SPL Token with the visa-demo fee-payer as mint authority,
 * 6 decimals (USDC convention so display math doesn't change). The mint
 * pubkey is written to `web/src/lib/sandbox-mint.json`, which is committed
 * to the repo — pubkeys are public addresses, not secrets.
 *
 * Idempotent: if `sandbox-mint.json` already holds a mint that the on-chain
 * Mint account exists for, exits early without creating a new one. Re-run
 * with `FORCE=1 node scripts/setup-sandbox-mint.mjs` to mint a fresh token.
 *
 * Run from `web/`:
 *
 *   KOMMIT_DEVNET_FEE_PAYER_SECRET=<base58> node scripts/setup-sandbox-mint.mjs
 *
 * The fee-payer keypair must already be funded with at least ~0.01 SOL on
 * devnet to pay rent for the new Mint account. Use scripts/setup-visa-fee-payer.mjs
 * if it isn't yet.
 *
 * --- Codex Pass 1 hardenings ---
 *
 * L2 (empty-JSON recovery): if `sandbox-mint.json` exists but has empty
 * `mint`/`mintAuthority` fields, REFUSE to silently create a fresh mint.
 * That state is indistinguishable from "operator accidentally cleared a
 * healthy file" and a silent re-create orphans the previous mint along
 * with anyone holding sandbox-token balances on it. Recovery options:
 *
 *   - Restore a known mint pubkey:
 *       MINT=<base58> KOMMIT_DEVNET_FEE_PAYER_SECRET=<…> node scripts/setup-sandbox-mint.mjs
 *   - Confirm fresh-mint creation (orphans the old one):
 *       FORCE=1 KOMMIT_DEVNET_FEE_PAYER_SECRET=<…> node scripts/setup-sandbox-mint.mjs
 *
 * The very first run on a fresh repo also requires `FORCE=1` (the file
 * ships with empty fields by design) — this is a one-time speed bump in
 * exchange for never silently double-minting on accidents thereafter.
 *
 * M3 (cluster confinement): before any side-effecting RPC call, fetch
 * `getGenesisHash()` and verify it matches the devnet genesis hash
 * (`EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`). A mis-pointed
 * `NEXT_PUBLIC_HELIUS_RPC_URL` (e.g. mainnet) would otherwise mint a real
 * SPL token and write `cluster: "devnet"` to JSON regardless.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { createMint, getMint } from "@solana/spl-token";
import bs58 from "bs58";

const HERE = dirname(fileURLToPath(import.meta.url));
const MINT_JSON_PATH = resolve(HERE, "../src/lib/sandbox-mint.json");
const RPC_URL =
  process.env.NEXT_PUBLIC_HELIUS_RPC_URL ?? "https://api.devnet.solana.com";
const SECRET = process.env.KOMMIT_DEVNET_FEE_PAYER_SECRET;
const DECIMALS = 6;
const FORCE = process.env.FORCE === "1";
const MINT_OVERRIDE = process.env.MINT?.trim();

/** Devnet genesis hash. Same value the `solana-test-validator` ships with;
 *  cross-check via `solana cluster-version --url devnet` if in doubt. */
const DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";

function loadFeePayer() {
  if (!SECRET) {
    console.error(
      "KOMMIT_DEVNET_FEE_PAYER_SECRET unset. Run scripts/setup-visa-fee-payer.mjs",
    );
    console.error("first if you don't have a fee-payer keypair yet, then re-run this");
    console.error("with the secret in env. Refusing to create a fresh keypair so the");
    console.error("Lane B mint stays under the same authority as the visa-demo relay.");
    process.exit(1);
  }
  const trimmed = SECRET.trim();
  let bytes;
  try {
    if (trimmed.startsWith("[")) {
      bytes = new Uint8Array(JSON.parse(trimmed));
    } else {
      bytes = bs58.decode(trimmed);
    }
  } catch (e) {
    console.error("KOMMIT_DEVNET_FEE_PAYER_SECRET could not be decoded:", e?.message ?? e);
    process.exit(1);
  }
  if (bytes.length !== 64) {
    console.error(
      `KOMMIT_DEVNET_FEE_PAYER_SECRET must decode to 64 bytes (got ${bytes.length}).`,
    );
    process.exit(1);
  }
  return Keypair.fromSecretKey(bytes);
}

/** Inspect the on-disk JSON. Returns one of:
 *   { state: "absent" }                       — file does not exist
 *   { state: "corrupt", error }               — file exists but JSON.parse threw
 *   { state: "populated", mint }              — has a non-empty mint pubkey
 *   { state: "empty" }                        — exists, parses, but mint field empty/missing
 */
function inspectMintJson() {
  if (!existsSync(MINT_JSON_PATH)) return { state: "absent" };
  let json;
  try {
    json = JSON.parse(readFileSync(MINT_JSON_PATH, "utf8"));
  } catch (e) {
    return { state: "corrupt", error: e?.message ?? String(e) };
  }
  if (typeof json?.mint === "string" && json.mint.length > 0) {
    return { state: "populated", mint: json.mint };
  }
  return { state: "empty" };
}

function writeMintJson(args) {
  const dir = dirname(MINT_JSON_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const body = {
    cluster: "devnet",
    decimals: args.decimals,
    mint: args.mint,
    mintAuthority: args.mintAuthority,
    createdAt: new Date().toISOString(),
  };
  writeFileSync(MINT_JSON_PATH, JSON.stringify(body, null, 2) + "\n", "utf8");
}

const conn = new Connection(RPC_URL, "confirmed");

// M3: cluster confinement. Refuse to do anything if the RPC isn't devnet.
async function assertDevnet() {
  let genesis;
  try {
    genesis = await conn.getGenesisHash();
  } catch (e) {
    console.error(`Could not read genesis hash from ${RPC_URL}:`, e?.message ?? e);
    process.exit(1);
  }
  if (genesis !== DEVNET_GENESIS_HASH) {
    console.error(
      `RPC ${RPC_URL} is not devnet (genesis ${genesis} != ${DEVNET_GENESIS_HASH}).`,
    );
    console.error(
      "Refusing to create a sandbox mint outside devnet. Unset NEXT_PUBLIC_HELIUS_RPC_URL",
    );
    console.error("or point it at a devnet RPC and re-run.");
    process.exit(1);
  }
}

await assertDevnet();

const inspection = inspectMintJson();

// ---------- Recovery mode: restore a known mint pubkey without re-creating. ----------
if (MINT_OVERRIDE) {
  let mintPubkey;
  try {
    mintPubkey = new PublicKey(MINT_OVERRIDE);
  } catch (e) {
    console.error(`MINT=${MINT_OVERRIDE} is not a valid base58 pubkey:`, e?.message ?? e);
    process.exit(1);
  }
  let info;
  try {
    info = await getMint(conn, mintPubkey);
  } catch (e) {
    console.error(`Mint ${MINT_OVERRIDE} not found on devnet:`, e?.message ?? e);
    process.exit(1);
  }
  writeMintJson({
    mint: mintPubkey.toBase58(),
    decimals: info.decimals,
    mintAuthority: info.mintAuthority?.toBase58() ?? "",
  });
  console.log("Restored sandbox mint from MINT= override.");
  console.log(`  mint:           ${mintPubkey.toBase58()}`);
  console.log(`  decimals:       ${info.decimals}`);
  console.log(`  mintAuthority:  ${info.mintAuthority?.toBase58() ?? "(none)"}`);
  console.log(`  written to:     ${MINT_JSON_PATH}`);
  process.exit(0);
}

if (!FORCE) {
  if (inspection.state === "populated") {
    try {
      const info = await getMint(conn, new PublicKey(inspection.mint));
      console.log("Existing sandbox mint is healthy. No action.");
      console.log(`  mint:           ${inspection.mint}`);
      console.log(`  decimals:       ${info.decimals}`);
      console.log(`  mintAuthority:  ${info.mintAuthority?.toBase58() ?? "(none)"}`);
      console.log(`  supply:         ${info.supply.toString()}`);
      console.log("");
      console.log("Re-run with FORCE=1 to create a fresh mint.");
      process.exit(0);
    } catch (e) {
      console.warn(
        `sandbox-mint.json points at ${inspection.mint}, but the on-chain mint isn't readable:`,
        e?.message ?? e,
      );
      console.warn(
        "Refusing to silently create a replacement — that mint may exist on a different",
      );
      console.warn(
        "RPC. Re-run with FORCE=1 to mint a fresh one, or MINT=<pubkey> to restore.",
      );
      process.exit(1);
    }
  }

  // L2: empty/corrupt → fail fast unless FORCE=1 / MINT= specified.
  if (inspection.state === "empty") {
    console.error("sandbox-mint.json exists but has no mint pubkey set.");
    console.error(
      "Refusing to silently create a fresh mint — an empty file is",
    );
    console.error(
      "indistinguishable from an accidentally cleared healthy one, and",
    );
    console.error(
      "creating a replacement would orphan any sandbox-token balances on the",
    );
    console.error("previous mint.");
    console.error("");
    console.error("Recovery options:");
    console.error(
      "  - Restore a known mint:  MINT=<pubkey> node scripts/setup-sandbox-mint.mjs",
    );
    console.error(
      "  - Confirm fresh creation: FORCE=1 node scripts/setup-sandbox-mint.mjs",
    );
    process.exit(1);
  }

  if (inspection.state === "corrupt") {
    console.error(`sandbox-mint.json is unreadable: ${inspection.error}`);
    console.error(
      "Restore from git history, or re-run with FORCE=1 to overwrite (creates a fresh mint).",
    );
    process.exit(1);
  }
}

const feePayer = loadFeePayer();
const balance = await conn.getBalance(feePayer.publicKey, "confirmed");
console.log(`Fee-payer pubkey:  ${feePayer.publicKey.toBase58()}`);
console.log(`Fee-payer balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
if (balance < 0.01 * LAMPORTS_PER_SOL) {
  console.warn(
    "Fee-payer balance is below 0.01 SOL — mint creation may fail for rent.",
  );
  console.warn(`Top up: solana airdrop 1 ${feePayer.publicKey.toBase58()} --url devnet`);
}

console.log("Creating new SPL mint on devnet…");
const mintPubkey = await createMint(
  conn,
  feePayer,
  feePayer.publicKey, // mint authority
  feePayer.publicKey, // freeze authority — same payer; not used in practice
  DECIMALS,
);

writeMintJson({
  mint: mintPubkey.toBase58(),
  decimals: DECIMALS,
  mintAuthority: feePayer.publicKey.toBase58(),
});

console.log("");
console.log("=".repeat(72));
console.log("Sandbox mint created.");
console.log(`  mint:           ${mintPubkey.toBase58()}`);
console.log(`  decimals:       ${DECIMALS}`);
console.log(`  mintAuthority:  ${feePayer.publicKey.toBase58()}`);
console.log(`  written to:     ${MINT_JSON_PATH}`);
console.log("=".repeat(72));
console.log("");
console.log("Next steps:");
console.log("  1. git add web/src/lib/sandbox-mint.json && commit");
console.log("  2. Set SANDBOX_API_ENABLED=1 in Vercel env (preview + production).");
console.log("  3. Redeploy. Lane B's /sandbox/onchain airdrop is now live.");
