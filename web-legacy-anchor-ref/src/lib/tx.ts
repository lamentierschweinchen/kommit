/**
 * On-chain commit + withdraw helpers. Build txs via Anchor's typed methods
 * builder; sign + send via the Privy-wallet-backed AnchorProvider.
 *
 * Withdraw v1 caveat: only handles the escrow-only path (when escrow has
 * enough liquid USDC to cover the requested amount). When `supply_to_yield_source`
 * has moved funds into klend, withdraws need the klend account graph passed
 * via `remaining_accounts` per program_spec.md § withdraw + the spike branch.
 * v1 private beta avoids this by NOT auto-supplying — keep funds in escrow.
 * v1.5 adds the klend redeem path here.
 */

import { BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  findCommitmentPda,
  findConfigPda,
  findEscrowPda,
  findProjectPda,
} from "@/lib/kommit";
import { USDC_MINT_DEVNET, type KommitClient } from "@/lib/anchor-client";

/** USDC has 6 decimals on Solana. */
export const USDC_DECIMALS = 6;

export function dollarsToBaseUnits(amount: number): BN {
  return new BN(Math.round(amount * 10 ** USDC_DECIMALS));
}

export function baseUnitsToDollars(amount: BN | bigint | number): number {
  const n = typeof amount === "number" ? amount : Number(amount);
  return n / 10 ** USDC_DECIMALS;
}

export type TxResult = { signature: string };

export async function commitToProject(
  client: KommitClient,
  recipientWallet: PublicKey,
  amountDollars: number,
  usdcMint: PublicKey = USDC_MINT_DEVNET
): Promise<TxResult> {
  const user = client.provider.wallet.publicKey;
  const project = findProjectPda(recipientWallet);
  const commitment = findCommitmentPda(user, project);
  const escrow = findEscrowPda(project);
  const config = findConfigPda();
  const userUsdcAta = getAssociatedTokenAddressSync(usdcMint, user, false);

  const sig = await client.program.methods
    .commit(dollarsToBaseUnits(amountDollars))
    .accountsPartial({
      commitment,
      project,
      user,
      userUsdcTokenAccount: userUsdcAta,
      escrowTokenAccount: escrow,
      usdcMint,
      config,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return { signature: sig };
}

export async function withdrawFromProject(
  client: KommitClient,
  recipientWallet: PublicKey,
  amountDollars: number,
  usdcMint: PublicKey = USDC_MINT_DEVNET
): Promise<TxResult> {
  const user = client.provider.wallet.publicKey;
  const project = findProjectPda(recipientWallet);
  const commitment = findCommitmentPda(user, project);
  const escrow = findEscrowPda(project);
  const userUsdcAta = getAssociatedTokenAddressSync(usdcMint, user, false);

  const sig = await client.program.methods
    .withdraw(dollarsToBaseUnits(amountDollars), new BN(0))
    .accountsPartial({
      commitment,
      project,
      user,
      userUsdcTokenAccount: userUsdcAta,
      escrowTokenAccount: escrow,
      usdcMint,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();

  return { signature: sig };
}
