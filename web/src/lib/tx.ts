/**
 * On-chain commit + withdraw helpers. Build txs via Anchor's typed methods
 * builder; sign + send via the Privy-wallet-backed AnchorProvider.
 *
 * Money math goes through `lib/money.ts` — `parseTokenAmount` for
 * decimal-string → u64 base units, exact and overflow-safe. Codex M7:
 * "treat the new mock commit/withdraw modals as UI-only and require Pass 2
 * to swap all transaction amounts to parseTokenAmount/validateAmount."
 *
 * Withdraw caveat: only handles the escrow-only path (when escrow has enough
 * liquid USDC to cover). Pass 2 hardcodes `redeem_collateral_amount = 0` —
 * the 14-account klend redeem graph is v1.5 scope.
 */

import { BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
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
import { parseTokenAmount, formatTokenAmount } from "@/lib/money";

/** USDC has 6 decimals on Solana. */
export const USDC_DECIMALS = 6;

/**
 * Convert a decimal user-input string (e.g. "100.5") into an Anchor BN
 * over u64 base units. Throws on malformed/negative/overflow inputs;
 * caller should pre-validate via `validateAmount` and surface inline errors
 * before invoking the tx helper.
 */
export function parseAmountToBn(amount: string): BN {
  const baseUnits = parseTokenAmount(amount, USDC_DECIMALS);
  return new BN(baseUnits.toString());
}

/** Format u64 base units (bigint) as a USDC decimal string for display. */
export function formatBaseUnits(baseUnits: bigint): string {
  return formatTokenAmount(baseUnits, USDC_DECIMALS);
}

export type TxResult = { signature: string };

export async function commitToProject(
  client: KommitClient,
  recipientWallet: PublicKey,
  amount: string,
  usdcMint: PublicKey = USDC_MINT_DEVNET,
): Promise<TxResult> {
  const user = client.provider.wallet.publicKey;
  const project = findProjectPda(recipientWallet);
  const commitment = findCommitmentPda(user, project);
  const escrow = findEscrowPda(project);
  const config = findConfigPda();
  const userUsdcAta = getAssociatedTokenAddressSync(usdcMint, user, false);

  const sig = await client.program.methods
    .commit(parseAmountToBn(amount))
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
  amount: string,
  usdcMint: PublicKey = USDC_MINT_DEVNET,
): Promise<TxResult> {
  const user = client.provider.wallet.publicKey;
  const project = findProjectPda(recipientWallet);
  const commitment = findCommitmentPda(user, project);
  const escrow = findEscrowPda(project);
  const userUsdcAta = getAssociatedTokenAddressSync(usdcMint, user, false);

  const sig = await client.program.methods
    .withdraw(parseAmountToBn(amount), new BN(0))
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
