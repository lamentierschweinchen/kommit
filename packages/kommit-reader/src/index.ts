/**
 * @kommit/reader — open-source TypeScript SDK for reading Kommit conviction
 * records on Solana.
 *
 * Public API:
 *   getKommitsForWallet     — all conviction records for a wallet (across projects)
 *   getKommittersForProject — all kommitters of a single project
 *   getReadProgram          — escape hatch: a typed read-only Program<Kommit>
 *
 *   findProjectPda          — derive a Project PDA from a recipient wallet
 *   findCommitmentPda       — derive a (user, project) Commitment PDA
 *   KOMMIT_PROGRAM_ID       — the deployed devnet program ID
 *   SEEDS                   — raw seed buffers (advanced; pdas helpers cover the common cases)
 *
 *   KommitRecord            — the SDK return shape (flat, bigint-typed)
 *   Kommit                  — the Anchor IDL type, exported for power users
 *
 * License: MIT. Source: https://github.com/lamentierschweinchen/kommit/tree/main/app/packages/kommit-reader
 */

export {
  KOMMIT_PROGRAM_ID,
  SEEDS,
  findProjectPda,
  findCommitmentPda,
} from "./pdas";

export {
  getReadProgram,
  getKommitsForWallet,
  getKommittersForProject,
} from "./reader";

export type { KommitRecord, Kommit } from "./types";
