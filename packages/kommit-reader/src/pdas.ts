/**
 * PDA derivation helpers + program ID constant.
 *
 * Pure — no RPC calls, no signing. Use these to compute the on-chain
 * addresses for Kommit accounts before reading them.
 *
 * Seeds match `app/programs/kommit/src/state.rs` exactly:
 *   project    : [b"project",    recipient_wallet]
 *   commitment : [b"commitment", user, project]
 */

import { PublicKey } from "@solana/web3.js";

/**
 * Kommit program ID (devnet). Pinned to the current deployed program. When
 * the mainnet deployment ships, the SDK bumps to a new minor version and
 * exposes both via a config flag — for now, devnet is the only environment.
 *
 * See: https://explorer.solana.com/address/GxM3sxMp4FyrkHK4g1DaDrmwYLrwd2BJKxqKZqvGgkc3?cluster=devnet
 */
export const KOMMIT_PROGRAM_ID: PublicKey = new PublicKey(
  "GxM3sxMp4FyrkHK4g1DaDrmwYLrwd2BJKxqKZqvGgkc3",
);

/**
 * Account-PDA seed bytes. Exposed for advanced integrators who want to
 * derive non-standard PDAs (e.g. escrow / collateral / lending) — for the
 * common cases (Project, Commitment) prefer `findProjectPda` /
 * `findCommitmentPda`.
 */
export const SEEDS = {
  config: Buffer.from("config"),
  project: Buffer.from("project"),
  commitment: Buffer.from("commitment"),
  escrow: Buffer.from("escrow"),
  collateral: Buffer.from("collateral"),
  lending: Buffer.from("lending"),
} as const;

/**
 * Derive the on-chain `Project` PDA from a project's recipient wallet.
 *
 * @param recipientWallet The team / founder wallet that receives routed yield.
 * @param programId       Override for non-default deployments.
 * @returns               The Project PDA.
 */
export function findProjectPda(
  recipientWallet: PublicKey,
  programId: PublicKey = KOMMIT_PROGRAM_ID,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEEDS.project, recipientWallet.toBuffer()],
    programId,
  )[0];
}

/**
 * Derive the on-chain `Commitment` PDA for a (user, project) pair. This is
 * the address holding `KommitRecord` data — every commit / withdraw / accrue
 * touches this account.
 *
 * @param user      Kommitter wallet.
 * @param project   Project PDA (from `findProjectPda` above).
 * @param programId Override for non-default deployments.
 * @returns         The Commitment PDA.
 */
export function findCommitmentPda(
  user: PublicKey,
  project: PublicKey,
  programId: PublicKey = KOMMIT_PROGRAM_ID,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEEDS.commitment, user.toBuffer(), project.toBuffer()],
    programId,
  )[0];
}
