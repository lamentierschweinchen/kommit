"use client";

/**
 * Tiny helper that renders a truncated tx-signature link to Solscan
 * (devnet cluster). Used wherever Lane B surfaces an on-chain artifact —
 * airdrop responses, commit success states, etc. The truncated label
 * keeps long signatures from breaking layout while the click target
 * still resolves to the full tx detail page.
 */

import { cn } from "@/lib/cn";

export type SolscanLinkProps = {
  /** Base58 tx signature, account address, or token mint pubkey. */
  signature: string;
  /** What flavor of explorer page to link. Defaults to `tx`. */
  kind?: "tx" | "account" | "token";
  /** Override the visible label (else: first4…last4 of the signature). */
  label?: string;
  className?: string;
};

function truncate(s: string): string {
  if (s.length <= 12) return s;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

export function SolscanLink({
  signature,
  kind = "tx",
  label,
  className,
}: SolscanLinkProps) {
  const href = `https://solscan.io/${kind}/${signature}?cluster=devnet`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "underline decoration-2 underline-offset-2 hover:text-primary break-all",
        className,
      )}
    >
      {label ?? truncate(signature)}
    </a>
  );
}
