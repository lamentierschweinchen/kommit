/**
 * Frontend Anchor program client. Constructs a `Program<Kommit>` from the
 * generated IDL + Privy-embedded wallet, exposed via `useKommitProgram()`.
 *
 * Codex § Layer 5 / handoff 32 § 6 wallet-null guard: every consumer must
 * `if (!client) return <Skeleton />;` — the wallet is null until Privy
 * resolves the embedded wallet, and signing during that gap is the most
 * common Pass 2 footgun.
 */

"use client";

import { useMemo } from "react";
import { AnchorProvider, Program, type Idl, type Wallet } from "@coral-xyz/anchor";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { useWallets, type ConnectedStandardSolanaWallet } from "@privy-io/react-auth/solana";
import { SOLANA_CHAIN, useSolanaConnection } from "@/components/providers";
import idl from "@/lib/idl/kommit.json";
import { KOMMIT_PROGRAM_ID, type Kommit } from "@/lib/kommit";

/** Devnet USDC mint (Circle's faucet-mintable). */
export const USDC_MINT_DEVNET = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
);

/**
 * Wraps a Privy Solana embedded wallet to satisfy Anchor's `Wallet` interface.
 * Anchor only calls `signTransaction` / `signAllTransactions`; we never expose
 * a private key. Codex Layer 5 § Anchor: "Privy embedded wallet signs user
 * transactions. Server may build/read/validate, but must not sign commit/
 * withdraw on behalf of users."
 */
function adaptWallet(privyWallet: ConnectedStandardSolanaWallet): Wallet {
  const publicKey = new PublicKey(privyWallet.address);

  async function signTransaction<T extends Transaction | VersionedTransaction>(
    tx: T,
  ): Promise<T> {
    const bytes =
      tx instanceof VersionedTransaction
        ? tx.serialize()
        : tx.serialize({ requireAllSignatures: false, verifySignatures: false });
    // Pass `chain` explicitly — Privy's standard-wallet signTransaction
    // looks the chain up against `config.solana.rpcs`. Without it the SDK
    // falls back to solana:mainnet, which we don't configure (devnet only
    // for v0.1).
    const { signedTransaction } = await privyWallet.signTransaction({
      transaction: bytes,
      chain: SOLANA_CHAIN,
    });
    if (tx instanceof VersionedTransaction) {
      return VersionedTransaction.deserialize(signedTransaction) as T;
    }
    return Transaction.from(signedTransaction) as T;
  }

  async function signAllTransactions<T extends Transaction | VersionedTransaction>(
    txs: T[],
  ): Promise<T[]> {
    const out: T[] = [];
    for (const tx of txs) out.push(await signTransaction(tx));
    return out;
  }

  return {
    publicKey,
    signTransaction,
    signAllTransactions,
    payer: undefined as unknown as never,
  } as unknown as Wallet;
}

export type KommitClient = {
  program: Program<Kommit>;
  provider: AnchorProvider;
  wallet: ConnectedStandardSolanaWallet;
};

/**
 * Returns a Kommit program client when a Solana wallet is connected, else null.
 * The wallet is the first connected Privy embedded Solana wallet.
 */
export function useKommitProgram(): KommitClient | null {
  const { wallets } = useWallets();
  const { connection } = useSolanaConnection();

  return useMemo(() => {
    const wallet = wallets[0];
    if (!wallet) return null;
    const adapted = adaptWallet(wallet);
    const provider = new AnchorProvider(connection, adapted, {
      commitment: "confirmed",
    });
    const program = new Program<Kommit>(idl as unknown as Idl, provider);
    if (program.programId.toBase58() !== KOMMIT_PROGRAM_ID.toBase58()) {
      console.warn(
        `Anchor program ID mismatch — IDL says ${program.programId.toBase58()}, env says ${KOMMIT_PROGRAM_ID.toBase58()}`,
      );
    }
    return { program, provider, wallet };
  }, [wallets, connection]);
}
