"use client";

/**
 * Reads the caller's sandbox SPL token balance from devnet.
 *
 * Used by the dashboard + CommitModal in real-Privy mode to surface "Available
 * to kommit" without sending the user back through `/sandbox/onchain` to learn
 * their funded position. The /demo on-chain entry airdrops the user $10K
 * before routing them to /dashboard; this hook is what makes that number
 * visible there.
 *
 * Returns:
 *   - `null`  while the read is in flight, the wallet isn't yet known, or the
 *             sandbox mint isn't configured (operator hasn't run setup).
 *   - `0`     the wallet's ATA doesn't exist yet (fresh wallet, pre-airdrop).
 *   - `number` the USD-nominal token balance (already divided by 10^decimals).
 *
 * Pass a `refreshKey` that increments after a successful commit to force a
 * re-read.
 */
import { useEffect, useState } from "react";
import {
  Connection,
  PublicKey,
} from "@solana/web3.js";
import {
  TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { getSandboxMintOrNull, SANDBOX_MINT_DECIMALS } from "@/lib/sandbox-mint";

const RPC_URL =
  process.env.NEXT_PUBLIC_HELIUS_RPC_URL ?? "https://api.devnet.solana.com";

const DECIMALS_DIVISOR = 10n ** BigInt(SANDBOX_MINT_DECIMALS);

function baseToUSD(base: bigint): number {
  const dollars = Number(base / DECIMALS_DIVISOR);
  const cents = Number(base % DECIMALS_DIVISOR) / Number(DECIMALS_DIVISOR);
  return dollars + cents;
}

export function useSandboxBalance(
  wallet: string | null | undefined,
  refreshKey?: number,
): number | null {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!wallet) {
      setBalance(null);
      return;
    }
    const mint = getSandboxMintOrNull();
    if (!mint) {
      setBalance(null);
      return;
    }
    let walletPk: PublicKey;
    try {
      walletPk = new PublicKey(wallet);
    } catch {
      setBalance(null);
      return;
    }
    let cancelled = false;
    const conn = new Connection(RPC_URL, "confirmed");
    const ata = getAssociatedTokenAddressSync(mint, walletPk, false);
    getAccount(conn, ata)
      .then((acc) => {
        if (cancelled) return;
        setBalance(baseToUSD(acc.amount));
      })
      .catch((e) => {
        if (cancelled) return;
        if (
          e instanceof TokenAccountNotFoundError ||
          e instanceof TokenInvalidAccountOwnerError
        ) {
          // Fresh wallet — no ATA yet. Render as 0 so the dashboard reads
          // "$0 available" instead of "—" before the airdrop completes.
          setBalance(0);
        } else {
          // Transient RPC error — leave as null so callers can show "—".
          setBalance(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [wallet, refreshKey]);

  return balance;
}
