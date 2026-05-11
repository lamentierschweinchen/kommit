/**
 * Server-side devnet RPC + memo-tx helper for the Visa-sandbox demo.
 *
 * The sandbox flow is honest about being a sandbox — the on-chain action
 * we record is a structured Memo transaction that the fee-payer signs. This
 * gives every onramp / offramp a Solscan-traceable signature without
 * requiring the user's Privy embedded wallet to sign anything (which would
 * either prompt the user — breaking the "invisible-tech" illusion — or
 * require Privy Server Wallets, a paid feature).
 *
 * Memo content shape (UTF-8):
 *
 *   "kommit:visa:onramp v1 user=<base58> project=<base58> amountUSDC=<num> ts=<unix>"
 *   "kommit:visa:offramp v1 user=<base58> project=<base58> amountUSDC=<num> ts=<unix>"
 *
 * Anyone scanning devnet for the Memo program ID can ingest these and
 * reconstruct sandbox demo activity. Real `commit` / `withdraw` Anchor
 * instructions are NOT fired in this flow — that's v1 work where Privy
 * server-side signing or a delegated-commit instruction lands.
 *
 * NAMING (Codex I1): downstream API responses surface this hash as
 * `memoTxHash` — never `commitTxHash` or `withdrawTxHash` — to keep the
 * sandbox-vs-real-Anchor distinction honest in the wire format.
 */

import "server-only";

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { getFeePayer } from "./sandbox-fee-payer";

const RPC_URL =
  process.env.NEXT_PUBLIC_HELIUS_RPC_URL ?? "https://api.devnet.solana.com";

/** SPL Memo program — same address on mainnet + devnet. */
export const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

let cachedConnection: Connection | null = null;
export function getDevnetConnection(): Connection {
  if (cachedConnection) return cachedConnection;
  cachedConnection = new Connection(RPC_URL, "confirmed");
  return cachedConnection;
}

/** Devnet genesis hash — same value reported by `solana cluster-version
 *  --url devnet`. Used as the cluster-confinement gate (Codex Pass 1 M3):
 *  we refuse to mint or transfer from any RPC whose genesis differs. */
export const DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";

let cachedClusterCheck: Promise<boolean> | null = null;

/** Returns true iff the configured RPC is devnet. Caches the result for
 *  the lifetime of the Node process — genesis hash doesn't change. Failures
 *  to reach the RPC are NOT cached so a transient outage doesn't lock the
 *  route into a "wrong cluster" state. */
export async function isDevnetCluster(): Promise<boolean> {
  if (cachedClusterCheck) return cachedClusterCheck;
  const promise = (async () => {
    try {
      const genesis = await getDevnetConnection().getGenesisHash();
      return genesis === DEVNET_GENESIS_HASH;
    } catch (e) {
      // Don't cache the failure; let the next call retry.
      cachedClusterCheck = null;
      throw e;
    }
  })();
  cachedClusterCheck = promise;
  return promise;
}

/** Lamport balance of an arbitrary devnet wallet. */
export async function getLamports(wallet: PublicKey): Promise<number> {
  return getDevnetConnection().getBalance(wallet, "confirmed");
}

/** Send `lamports` from the fee-payer to `to`. Returns the tx signature. */
export async function transferLamports(
  to: PublicKey,
  lamports: number,
): Promise<string> {
  const conn = getDevnetConnection();
  const fp = getFeePayer();
  const ix = SystemProgram.transfer({
    fromPubkey: fp.publicKey,
    toPubkey: to,
    lamports,
  });
  const tx = new Transaction().add(ix);
  tx.feePayer = fp.publicKey;
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.sign(fp);
  const sig = await conn.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });
  // Confirm to "confirmed" (NOT "finalized" — finalized doubles latency for
  // submission-video pacing without changing user-visible correctness).
  await conn.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed",
  );
  return sig;
}

export type MemoEventName = "onramp" | "offramp";

export type MemoEvent = {
  /** Caller's Privy embedded wallet. */
  user: PublicKey;
  /** On-chain Project PDA the demo is associated with. */
  projectPda: PublicKey;
  /** USDC base units (6 decimals). */
  amountUSDC: number;
};

/** Build the structured memo string that `recordMemo` writes on-chain. */
export function buildMemoString(kind: MemoEventName, evt: MemoEvent): string {
  const ts = Math.floor(Date.now() / 1000);
  return `kommit:visa:${kind} v1 user=${evt.user.toBase58()} project=${evt.projectPda.toBase58()} amountUSDC=${evt.amountUSDC} ts=${ts}`;
}

/** Submit a Memo tx signed by the fee-payer. Returns the signature. */
export async function recordMemo(
  kind: MemoEventName,
  evt: MemoEvent,
): Promise<string> {
  const conn = getDevnetConnection();
  const fp = getFeePayer();
  const memo = buildMemoString(kind, evt);
  const ix = new TransactionInstruction({
    keys: [], // memo program doesn't need any account keys
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memo, "utf8"),
  });
  const tx = new Transaction().add(ix);
  tx.feePayer = fp.publicKey;
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.sign(fp);
  const sig = await conn.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });
  await conn.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed",
  );
  return sig;
}

/** SOL → lamports convenience constant. */
export const SOL = LAMPORTS_PER_SOL;

/** Devnet USDC mint. Match the mint MoonPay Commerce settles into when
 *  the parent Pay Link is configured for USDC on Solana devnet. */
export const DEVNET_USDC_MINT = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
);

/**
 * Transfer USDC base units from the fee-payer's associated token account
 * to a recipient. Used by the sandbox webhook handler to relay USDC
 * from the merchant wallet (= fee-payer, configured as the Helio
 * recipient) to the kommitter's Privy wallet, after MoonPay confirms the
 * card-side settlement.
 *
 * Will create the recipient's associated token account if it doesn't
 * exist (fee-payer pays the rent — small one-time cost). Returns the
 * transaction signature.
 */
export async function transferDevnetUSDC(
  recipient: PublicKey,
  amountBaseUnits: number,
): Promise<string> {
  const conn = getDevnetConnection();
  const fp = getFeePayer();

  // Ensure the recipient ATA exists. `getOrCreateAssociatedTokenAccount`
  // returns the account info; if it had to create it, the rent comes from
  // the fee-payer.
  const recipientAta = await getOrCreateAssociatedTokenAccount(
    conn,
    fp,
    DEVNET_USDC_MINT,
    recipient,
    false,
  );

  const sourceAta = getAssociatedTokenAddressSync(
    DEVNET_USDC_MINT,
    fp.publicKey,
  );

  const ix = createTransferInstruction(
    sourceAta,
    recipientAta.address,
    fp.publicKey,
    BigInt(amountBaseUnits),
  );

  const tx = new Transaction().add(ix);
  tx.feePayer = fp.publicKey;
  const { blockhash, lastValidBlockHeight } =
    await conn.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.sign(fp);

  const sig = await conn.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });
  await conn.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed",
  );
  return sig;
}
