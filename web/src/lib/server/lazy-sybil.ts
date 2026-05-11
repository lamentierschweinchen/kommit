/**
 * On-chain sybil fallback for engagement gates (handoff 69 B1).
 *
 * Real-Privy users in the current devnet deploy commit under the *sandbox*
 * Project PDA, not the catalog one — fresh recipient keypairs from
 * `setup-sandbox-projects.mjs` so their escrow ATAs use the sandbox SPL mint
 * (sandbox-projects.ts header explains the why). Plus v0.5 has no indexer:
 * commitments are never mirrored into Supabase.
 *
 * So `select pda from commitments where user_wallet = …` returns nothing
 * for a real on-chain kommitter, and the reactions/comments routes 403 with
 * "not-a-kommitter-of-this-project". This helper closes the gap by checking
 * the Commitment account directly via Solana RPC under both candidate PDAs
 * (catalog wallet derivation + sandbox-projects.json mapping for the same
 * slug). The Anchor program is read-only.
 */

import { AnchorProvider, Program, type Idl, type Wallet } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import idl from "@/lib/idl/kommit.json";
import { type Kommit, findCommitmentPda } from "@/lib/kommit";
import { getSandboxProjects } from "@/lib/sandbox-projects";

const RPC_URL =
  process.env.NEXT_PUBLIC_HELIUS_RPC_URL ?? "https://api.devnet.solana.com";

let cachedReadProgram: Program<Kommit> | null = null;

function getReadProgram(): Program<Kommit> {
  if (cachedReadProgram) return cachedReadProgram;
  const connection = new Connection(RPC_URL, "confirmed");
  const dummyWallet = {
    publicKey: PublicKey.default,
    signTransaction: async () => {
      throw new Error("Read-only — lazy-sybil never signs");
    },
    signAllTransactions: async () => {
      throw new Error("Read-only — lazy-sybil never signs");
    },
  } as unknown as Wallet;
  const provider = new AnchorProvider(
    connection,
    dummyWallet,
    AnchorProvider.defaultOptions(),
  );
  cachedReadProgram = new Program<Kommit>(idl as unknown as Idl, provider);
  return cachedReadProgram;
}

/**
 * Returns true if the caller has a Commitment account on-chain against the
 * given project pda OR against the same-slug sandbox pda (real-Privy users
 * land on sandbox PDAs). Best-effort; returns false on RPC errors so a
 * flaky network doesn't open the gate.
 */
export async function hasOnChainCommitment(
  callerWallet: string,
  projectPda: string,
  hintSlug: string | null,
): Promise<boolean> {
  let userKey: PublicKey;
  let pdaKey: PublicKey;
  try {
    userKey = new PublicKey(callerWallet);
    pdaKey = new PublicKey(projectPda);
  } catch {
    return false;
  }

  const candidates: PublicKey[] = [pdaKey];
  if (hintSlug) {
    const sandbox = getSandboxProjects().find((p) => p.slug === hintSlug);
    if (sandbox && sandbox.projectPda.toBase58() !== projectPda) {
      candidates.push(sandbox.projectPda);
    }
  }

  const program = getReadProgram();
  for (const candidate of candidates) {
    const commitmentPda = findCommitmentPda(userKey, candidate);
    try {
      await program.account.commitment.fetch(commitmentPda);
      return true;
    } catch {
      /* not found under this candidate — try next */
    }
  }
  return false;
}
