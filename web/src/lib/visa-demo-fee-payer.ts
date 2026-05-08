/**
 * Server-only devnet fee payer for the Visa-sandbox demo.
 *
 * One Solana keypair held in env (`KOMMIT_DEVNET_FEE_PAYER_SECRET`, base58)
 * that the visa-demo API routes use for two purposes:
 *
 *   1. Airdrop SOL to a caller's Privy embedded wallet so commit txs can pay
 *      gas without surfacing it (`/api/visa-demo/pre-fund`).
 *   2. Sign + submit on-chain memo transactions that record sandbox onramp /
 *      offramp events (Solscan-traceable proof for the submission video).
 *
 * The keypair is devnet-only and worth ~5 SOL of test funds — not high-value,
 * but still a private key. Never log it; never echo the secret string.
 *
 * Generation steps for Lukas (one-time):
 *
 *   solana-keygen new --no-bip39-passphrase --outfile /tmp/kommit-devnet-fee-payer.json
 *   solana airdrop 5 $(solana-keygen pubkey /tmp/kommit-devnet-fee-payer.json) --url devnet
 *   node -e "console.log(require('bs58').encode(Buffer.from(JSON.parse(require('fs').readFileSync('/tmp/kommit-devnet-fee-payer.json')))))"
 *
 * Take that base58 output and set it as `KOMMIT_DEVNET_FEE_PAYER_SECRET` in
 * `.env.local` + Vercel preview/production env (Sensitive). Then `rm` the
 * tmp file. Re-airdrop if balance drops below ~1 SOL during the demo.
 */

import "server-only";

import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

let cached: Keypair | null = null;

export function getFeePayer(): Keypair {
  if (cached) return cached;
  const secret = process.env.KOMMIT_DEVNET_FEE_PAYER_SECRET;
  if (!secret) {
    throw new Error(
      "KOMMIT_DEVNET_FEE_PAYER_SECRET not set — visa-demo routes are non-functional. See web/src/lib/visa-demo-fee-payer.ts for setup steps.",
    );
  }
  // Accept either base58 (compact) or JSON-array (Solana CLI keygen output).
  // CLI format is a 64-byte JSON array; base58 is shorter and what we
  // recommend in .env.example.
  let bytes: Uint8Array;
  try {
    if (secret.trim().startsWith("[")) {
      bytes = new Uint8Array(JSON.parse(secret));
    } else {
      bytes = bs58.decode(secret.trim());
    }
  } catch (e) {
    throw new Error(
      `KOMMIT_DEVNET_FEE_PAYER_SECRET could not be decoded (expected base58 or JSON array): ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }
  if (bytes.length !== 64) {
    throw new Error(
      `KOMMIT_DEVNET_FEE_PAYER_SECRET must decode to 64 bytes (Solana ed25519 keypair); got ${bytes.length}`,
    );
  }
  cached = Keypair.fromSecretKey(bytes);
  return cached;
}

/** True iff the env var is set; lets routes return a clean "not configured"
 *  error instead of throwing on missing setup. */
export function isFeePayerConfigured(): boolean {
  return !!process.env.KOMMIT_DEVNET_FEE_PAYER_SECRET;
}
