/**
 * Kommit PDA helpers + program ID constants.
 *
 * Pure module — no React hooks, no providers. Both client and server code
 * (and any future scripts) import the same PDA derivation surface from here
 * to keep on-chain account addresses single-source-of-truth.
 *
 * Path note: the IDL JSON + types file lives at `./idl/`; copy fresh ones
 * after `anchor build` at the workspace root.
 *
 * Codex security note (handoff 33 § Layer 5): supabase clients deliberately
 * live in separate modules — anon-only at `@/lib/supabase` (browser-safe),
 * service-role at `@/lib/supabase-admin` (server-only). Don't merge them
 * back here.
 */

import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import idl from "./idl/kommit.json";
import type { Kommit } from "./idl/kommit";

export type { Kommit };

// ---------------------------------------------------------------------------
// Program ID + seeds — keep aligned with programs/kommit/src/state.rs.
// ---------------------------------------------------------------------------

export const KOMMIT_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_KOMMIT_PROGRAM_ID ??
    "GxM3sxMp4FyrkHK4g1DaDrmwYLrwd2BJKxqKZqvGgkc3",
);

export const SEEDS = {
  config: Buffer.from("config"),
  project: Buffer.from("project"),
  commitment: Buffer.from("commitment"),
  escrow: Buffer.from("escrow"),
  collateral: Buffer.from("collateral"),
  lending: Buffer.from("lending"),
} as const;

export const ADAPTER = {
  Kamino: 0,
} as const;
export type AdapterId = (typeof ADAPTER)[keyof typeof ADAPTER];

// ---------------------------------------------------------------------------
// PDA derivation. Pure — doesn't need a connection.
// ---------------------------------------------------------------------------

export function findConfigPda(programId: PublicKey = KOMMIT_PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync([SEEDS.config], programId)[0];
}

export function findProjectPda(
  recipientWallet: PublicKey,
  programId: PublicKey = KOMMIT_PROGRAM_ID,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEEDS.project, recipientWallet.toBuffer()],
    programId,
  )[0];
}

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

export function findEscrowPda(
  project: PublicKey,
  programId: PublicKey = KOMMIT_PROGRAM_ID,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEEDS.escrow, project.toBuffer()],
    programId,
  )[0];
}

export function findCollateralPda(
  project: PublicKey,
  programId: PublicKey = KOMMIT_PROGRAM_ID,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEEDS.collateral, project.toBuffer()],
    programId,
  )[0];
}

export function findLendingPositionPda(
  project: PublicKey,
  adapter: AdapterId = ADAPTER.Kamino,
  programId: PublicKey = KOMMIT_PROGRAM_ID,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEEDS.lending, project.toBuffer(), Buffer.from([adapter])],
    programId,
  )[0];
}

// ---------------------------------------------------------------------------
// Program instantiation helper for non-React callers (scripts, server reads).
// React clients should use `useKommitProgram()` from `@/lib/anchor-client`.
// ---------------------------------------------------------------------------

export function getAnchorProgram(provider: anchor.AnchorProvider): anchor.Program<Kommit> {
  return new anchor.Program(idl as anchor.Idl, provider) as unknown as anchor.Program<Kommit>;
}
