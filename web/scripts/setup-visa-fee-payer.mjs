/**
 * One-shot setup for the visa-demo fee-payer keypair.
 *
 * Generates an ed25519 keypair, airdrops 5 SOL on devnet, and prints the
 * base58-encoded secret you paste into `KOMMIT_DEVNET_FEE_PAYER_SECRET`
 * in `.env.local` + Vercel env (Sensitive).
 *
 * Run from `web/`:
 *
 *   node scripts/setup-visa-fee-payer.mjs
 *
 * Output goes to your terminal only — the secret is NOT written to disk.
 * Copy it once, paste into env, done. Re-run later to top up the balance
 * (it will generate a NEW keypair though; if you want to top up the
 * existing one, use `solana airdrop 5 <pubkey> --url devnet` after fixing
 * your zsh PATH).
 */

import { Keypair, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";

const RPC_URL = process.env.NEXT_PUBLIC_HELIUS_RPC_URL ?? "https://api.devnet.solana.com";

console.log("Generating new ed25519 keypair...");
const kp = Keypair.generate();
const pubkey = kp.publicKey.toBase58();
const secretBase58 = bs58.encode(kp.secretKey);

console.log("");
console.log(`  pubkey:  ${pubkey}`);
console.log("");

console.log(`Requesting 5 SOL airdrop on devnet (${RPC_URL})...`);
const conn = new Connection(RPC_URL, "confirmed");
let sig;
try {
  sig = await conn.requestAirdrop(kp.publicKey, 5 * LAMPORTS_PER_SOL);
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  await conn.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed",
  );
  console.log(`  airdrop tx: ${sig}`);
} catch (e) {
  console.warn(`  airdrop failed (${e instanceof Error ? e.message : String(e)})`);
  console.warn("  devnet airdrop is rate-limited — wait a minute and retry,");
  console.warn(`  or fund manually: solana airdrop 5 ${pubkey} --url devnet`);
}

const lamports = await conn.getBalance(kp.publicKey, "confirmed");
console.log(`  balance:    ${(lamports / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

console.log("");
console.log("=".repeat(72));
console.log("KOMMIT_DEVNET_FEE_PAYER_SECRET (paste into .env.local + Vercel):");
console.log("");
console.log(secretBase58);
console.log("=".repeat(72));
console.log("");
console.log("Next steps:");
console.log("  1. Add to web/.env.local:");
console.log(`       KOMMIT_DEVNET_FEE_PAYER_SECRET=${secretBase58.slice(0, 12)}...`);
console.log("  2. Add to Vercel preview/production env (Sensitive):");
console.log("       echo \"<secret>\" | vercel env add KOMMIT_DEVNET_FEE_PAYER_SECRET production --sensitive");
console.log("       (repeat for preview, development without --sensitive)");
console.log("  3. To top up balance later:");
console.log(`       solana airdrop 5 ${pubkey} --url devnet`);
console.log("");
