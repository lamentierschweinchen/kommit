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

function readExistingMint() {
  if (!existsSync(MINT_JSON_PATH)) return null;
  try {
    const json = JSON.parse(readFileSync(MINT_JSON_PATH, "utf8"));
    if (typeof json?.mint === "string" && json.mint.length > 0) return json.mint;
  } catch {
    /* fall through — treat as missing */
  }
  return null;
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

if (!FORCE) {
  const existing = readExistingMint();
  if (existing) {
    try {
      const info = await getMint(conn, new PublicKey(existing));
      console.log("Existing sandbox mint is healthy. No action.");
      console.log(`  mint:           ${existing}`);
      console.log(`  decimals:       ${info.decimals}`);
      console.log(`  mintAuthority:  ${info.mintAuthority?.toBase58() ?? "(none)"}`);
      console.log(`  supply:         ${info.supply.toString()}`);
      console.log("");
      console.log("Re-run with FORCE=1 to create a fresh mint.");
      process.exit(0);
    } catch (e) {
      console.warn(
        `sandbox-mint.json points at ${existing}, but the on-chain mint isn't readable:`,
        e?.message ?? e,
      );
      console.warn("Falling through to create a new one.");
    }
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
