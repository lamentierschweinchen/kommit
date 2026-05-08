/**
 * On-chain readers for Kommit's `Commitment` account.
 *
 * Two query shapes, both backed by `program.account.commitment.all([memcmp])`:
 *
 *   1. `getKommitsForWallet`     — every record where `user = walletAddress`
 *   2. `getKommittersForProject` — every record where `project = projectPda`
 *
 * Both return `KommitRecord[]` — flat, bigint-typed, ergonomic for downstream
 * UI / business-logic consumers.
 *
 * Reads are signing-free: the SDK constructs an `AnchorProvider` with a
 * dummy wallet whose `signTransaction` throws. If you accidentally try to
 * mutate state via this Program instance, you'll see the error
 * `read-only — @kommitapp/reader does not sign transactions`.
 *
 * Bring your own RPC URL — Helius, Triton, Solana Labs public endpoints
 * (devnet `https://api.devnet.solana.com`), or any other JSON-RPC node.
 */

import { AnchorProvider, Program, type Idl, type Wallet } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import idl from "./idl/kommit.json";
import type { Kommit } from "./idl/kommit";
import type { KommitRecord } from "./types";

/**
 * Construct a read-only `Program<Kommit>` against `rpcUrl`. Most callers
 * don't need this directly — `getKommitsForWallet` / `getKommittersForProject`
 * call it internally — but it's exported for advanced integrators who want
 * to drive their own queries via Anchor's typed account API.
 *
 * The returned program holds an `AnchorProvider` whose wallet refuses to
 * sign anything. Any attempt to send a transaction through it throws.
 */
export function getReadProgram(rpcUrl: string): Program<Kommit> {
  if (!rpcUrl) throw new Error("@kommitapp/reader: rpcUrl is required");
  const connection = new Connection(rpcUrl, "confirmed");
  const dummyWallet = {
    publicKey: PublicKey.default,
    signTransaction: async () => {
      throw new Error("read-only — @kommitapp/reader does not sign transactions");
    },
    signAllTransactions: async () => {
      throw new Error("read-only — @kommitapp/reader does not sign transactions");
    },
  } as unknown as Wallet;
  const provider = new AnchorProvider(
    connection,
    dummyWallet,
    AnchorProvider.defaultOptions(),
  );
  return new Program<Kommit>(idl as unknown as Idl, provider);
}

/**
 * "What's this wallet's conviction record across Kommit?"
 *
 * Returns every `KommitRecord` where the wallet is the kommitter (across
 * any project). Sorted by `lifetimeScore` descending — the strongest
 * conviction first — so a downstream "show their top backings" UI is one
 * `.slice(0, n)` away.
 *
 * @example
 * const records = await getKommitsForWallet(
 *   "https://api.devnet.solana.com",
 *   "5x9Lk...kT2"
 * );
 * for (const r of records) {
 *   console.log(`backed ${r.project.slice(0, 4)}…: ${r.lifetimeScore} kommits`);
 * }
 */
export async function getKommitsForWallet(
  rpcUrl: string,
  wallet: PublicKey | string,
): Promise<KommitRecord[]> {
  const userKey = typeof wallet === "string" ? new PublicKey(wallet) : wallet;
  const program = getReadProgram(rpcUrl);
  // memcmp at offset 8 = right after Anchor's 8-byte discriminator;
  // the `user: Pubkey` is the first field on Commitment.
  const accounts = await program.account.commitment.all([
    { memcmp: { offset: 8, bytes: userKey.toBase58() } },
  ]);
  return accounts.map(toKommitRecord).sort(byLifetimeDesc);
}

/**
 * "Who's backing this project, and how heavily?"
 *
 * Returns every `KommitRecord` where the project PDA matches. Sorted by
 * `lifetimeScore` descending — natural ordering for a cohort leaderboard
 * or "ranked by conviction" surface.
 *
 * @param projectPda The on-chain Project PDA. Use `findProjectPda(recipient)`
 *                   if you have the recipient wallet but not the PDA.
 *
 * @example
 * import { findProjectPda, getKommittersForProject } from "@kommitapp/reader";
 * import { PublicKey } from "@solana/web3.js";
 *
 * const project = findProjectPda(new PublicKey(recipientWallet));
 * const cohort  = await getKommittersForProject(rpcUrl, project);
 */
export async function getKommittersForProject(
  rpcUrl: string,
  projectPda: PublicKey | string,
): Promise<KommitRecord[]> {
  const projectKey =
    typeof projectPda === "string" ? new PublicKey(projectPda) : projectPda;
  const program = getReadProgram(rpcUrl);
  // memcmp at offset 8 + 32 = right after the user pubkey on Commitment;
  // the `project: Pubkey` is the second field.
  const accounts = await program.account.commitment.all([
    { memcmp: { offset: 8 + 32, bytes: projectKey.toBase58() } },
  ]);
  return accounts.map(toKommitRecord).sort(byLifetimeDesc);
}

// --- internal projection -----------------------------------------------------

type AnchorAccountWithCommitment = {
  publicKey: PublicKey;
  // Anchor's `program.account.commitment.all()` returns this shape; types
  // come from the IDL via the generated `Kommit` type. We accept loose
  // shapes here and project to the typed `KommitRecord` below.
  account: {
    user: PublicKey;
    project: PublicKey;
    principal: { toString(): string };
    depositTs: { toString(): string } | number;
    activeScore: { toString(): string };
    lifetimeScore: { toString(): string };
    lastAccrualTs: { toString(): string } | number;
  };
};

function toKommitRecord(a: AnchorAccountWithCommitment): KommitRecord {
  return {
    commitmentPda: a.publicKey.toBase58(),
    user: a.account.user.toBase58(),
    project: a.account.project.toBase58(),
    principal: BigInt(a.account.principal.toString()),
    depositTs: Number(
      typeof a.account.depositTs === "number"
        ? a.account.depositTs
        : a.account.depositTs.toString(),
    ),
    activeScore: BigInt(a.account.activeScore.toString()),
    lifetimeScore: BigInt(a.account.lifetimeScore.toString()),
    lastAccrualTs: Number(
      typeof a.account.lastAccrualTs === "number"
        ? a.account.lastAccrualTs
        : a.account.lastAccrualTs.toString(),
    ),
  };
}

function byLifetimeDesc(a: KommitRecord, b: KommitRecord): number {
  // bigint comparison → number for sort
  if (a.lifetimeScore > b.lifetimeScore) return -1;
  if (a.lifetimeScore < b.lifetimeScore) return 1;
  return 0;
}
