"use client";

import Link from "next/link";
import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Icon } from "@/components/common/Icon";
import { useToast } from "@/components/common/ToastProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { useDemoMode } from "@/lib/demo-mode";
import { truncateAddress } from "@/lib/wallet-display";
import { CardDepositForm } from "@/components/account/CardDepositForm";

/**
 * Deposit modal — opens from /dashboard.
 *
 * Two surfaces depending on the visitor:
 *
 *   1. Demo cohort (`useDemoMode`) — pre-funded localStorage simulator;
 *      no faucet flow needed. Single info panel.
 *   2. Real-Privy mode — primary path is "Top up with card" (handoff 64,
 *      a sandbox-SPL mint dressed up as a fiat top-up; settles onchain
 *      and updates the dashboard balance). Secondary path is the crypto-
 *      native receive-address copy + external devnet faucet links for
 *      visitors bringing their own funds.
 *
 * The submission narrative the card path supports: Kommit can accept
 * fiat-style deposits today. The implementation is a controlled-mint
 * route capped at $1K/deposit; the UX is a card visual + amount entry +
 * "Deposit $X" CTA. v1 swaps the mint for real card processing.
 */
export function DepositModal({
  open,
  onOpenChange,
  onDepositSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Fired after a successful card-deposit so the dashboard can refresh. */
  onDepositSuccess?: () => void;
}) {
  const { user } = useAuth();
  const { confirm } = useToast();
  const isDemo = useDemoMode();
  const [copied, setCopied] = useState(false);

  const wallet = user?.wallet ?? "";

  const handleCopy = async () => {
    if (!wallet) return;
    try {
      await navigator.clipboard.writeText(wallet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      confirm("Copy failed — long-press to select.");
    }
  };

  const handleCardDepositSuccess = ({
    amountUsd,
    txSignature,
  }: {
    amountUsd: number;
    txSignature: string;
  }) => {
    onOpenChange(false);
    confirm(
      `$${amountUsd.toLocaleString()} deposited`,
      "Settled onchain. Available to kommit now.",
      {
        recoveryLabel: "View tx",
        onRecover: () => {
          window.open(
            `https://solscan.io/tx/${txSignature}?cluster=devnet`,
            "_blank",
            "noopener,noreferrer",
          );
        },
      },
    );
    onDepositSuccess?.();
  };

  if (isDemo) {
    return (
      <Modal open={open} onOpenChange={onOpenChange} title="Demo cohort" shadow="default">
        <p className="mt-4 text-base font-medium text-gray-800 leading-relaxed border-l-[4px] border-primary pl-4">
          The demo cohort comes pre-funded — you can kommit and withdraw freely
          while you walk the demo. The faucet flow ships on the live product.
        </p>
        <div className="mt-7">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full bg-primary text-white font-epilogue font-black uppercase tracking-tight text-base py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform"
          >
            Got it
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Deposit" shadow="default">
      <p className="mt-3 text-sm font-medium text-gray-700 leading-relaxed border-l-[4px] border-primary pl-3">
        Top up with a card and your kommit balance updates the moment
        the deposit settles on devnet.
      </p>

      <CardDepositForm onSuccess={handleCardDepositSuccess} />

      <div className="mt-7 pt-6 border-t-[2px] border-black/10">
        <div className="font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest mb-2">
          Already have USDC?
        </div>
        <p className="text-xs font-medium text-gray-600 leading-relaxed mb-3">
          Send devnet USDC straight to your wallet — or grab some from the
          faucet.
        </p>
        <div className="bg-gray-100 border-[3px] border-black p-3 flex items-center justify-between gap-3">
          <code
            className="font-mono text-xs md:text-sm text-black min-w-0 truncate"
            title={wallet || undefined}
          >
            {wallet ? truncateAddress(wallet) : "—"}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!wallet}
            className="shrink-0 bg-white text-black font-epilogue font-black uppercase tracking-tight text-[10px] px-2.5 py-1.5 border-[2px] border-black shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5"
          >
            <Icon name={copied ? "check" : "content_copy"} size="sm" />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link
            href="https://faucet.circle.com/"
            target="_blank"
            rel="noreferrer noopener"
            className="bg-white text-black font-epilogue font-black uppercase tracking-tight text-[10px] px-2 py-2 border-[2px] border-black shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform flex items-center justify-center gap-1 text-center"
          >
            USDC faucet
            <Icon name="arrow_outward" size="sm" />
          </Link>
          <Link
            href="https://faucet.solana.com/"
            target="_blank"
            rel="noreferrer noopener"
            className="bg-white text-black font-epilogue font-black uppercase tracking-tight text-[10px] px-2 py-2 border-[2px] border-black shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform flex items-center justify-center gap-1 text-center"
          >
            SOL faucet
            <Icon name="arrow_outward" size="sm" />
          </Link>
        </div>
      </div>
    </Modal>
  );
}
