"use client";

import Link from "next/link";
import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Icon } from "@/components/common/Icon";
import { useToast } from "@/components/common/ToastProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { useDemoMode } from "@/lib/demo-mode";
import { truncateAddress } from "@/lib/wallet-display";

/**
 * Deposit / faucet UX (Pass 2 dispatch).
 *
 * Lukas's lean: lightweight manual flow. We surface the user's embedded
 * wallet address with a copy-to-clipboard helper, then bounce them out to
 * Circle's USDC devnet faucet + Solana's SOL devnet faucet in new tabs.
 * No programmatic airdrop — devnet faucets rate-limit aggressively and the
 * two-tab dance signals "test funds" honestly.
 *
 * Copy is anchored to vision.md's "What it plugs into" framing: today's v0.1
 * runs on Solana devnet using USDC; the fiat-rail layer (card / SEPA / bank
 * transfer) is the v1 milestone, not a bug.
 */
export function DepositModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
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
      // Fallback toast for non-clipboard contexts (rare)
      confirm("Copy failed — long-press to select.");
    }
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
    <Modal open={open} onOpenChange={onOpenChange} title="Get test funds" shadow="default">
      <p className="mt-4 text-base font-medium text-gray-800 leading-relaxed border-l-[4px] border-primary pl-4">
        Kommit is on Solana devnet for v0.1. To kommit, you&rsquo;ll need devnet USDC + a small
        amount of devnet SOL for transaction fees.
      </p>

      <div className="mt-6">
        <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest mb-2">
          Your wallet
        </div>
        <div className="bg-gray-100 border-[3px] border-black p-4 flex items-center justify-between gap-3">
          <code
            className="font-mono text-sm md:text-base text-black min-w-0 truncate"
            title={wallet || undefined}
          >
            {wallet ? truncateAddress(wallet) : "—"}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!wallet}
            className="shrink-0 bg-white text-black font-epilogue font-black uppercase tracking-tight text-xs px-3 py-2 border-[2px] border-black shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5"
          >
            <Icon name={copied ? "check" : "content_copy"} size="sm" />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link
          href="https://faucet.circle.com/"
          target="_blank"
          rel="noreferrer noopener"
          className="bg-primary text-white font-epilogue font-black uppercase tracking-tight text-sm px-4 py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2 text-center"
        >
          Get devnet USDC
          <Icon name="arrow_outward" size="sm" />
        </Link>
        <Link
          href="https://faucet.solana.com/"
          target="_blank"
          rel="noreferrer noopener"
          className="bg-white text-black font-epilogue font-black uppercase tracking-tight text-sm px-4 py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2 text-center"
        >
          Get devnet SOL
          <Icon name="arrow_outward" size="sm" />
        </Link>
      </div>

      <p className="mt-6 text-sm font-medium text-gray-700 leading-relaxed">
        Today, Kommit runs on Solana devnet using USDC. The fiat-rail layer (card / SEPA / bank
        transfer) is the v1 milestone —{" "}
        <Link
          href="/about"
          className="text-primary font-bold hover:underline"
          onClick={() => onOpenChange(false)}
        >
          read the vision
        </Link>{" "}
        for the full path.
      </p>
    </Modal>
  );
}
