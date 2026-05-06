"use client";

import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { Modal } from "@/components/common/Modal";
import { useToast } from "@/components/common/ToastProvider";
import { useKommitProgram } from "@/lib/anchor-client";
import { withdrawFromProject } from "@/lib/tx";
import { mapAnchorError } from "@/lib/anchor-errors";
import { formatUSD } from "@/lib/kommit-math";
import { cn } from "@/lib/cn";

const PERCENT_PRESETS = [0.25, 0.5, 0.75, 1];

/**
 * Audit fix #13: [25%] [50%] [75%] [Max] preset chips + custom amount input.
 * Pass 2: wired to on-chain `withdrawFromProject`. Escrow-only path; klend
 * redeem graph stays v1.5 scope.
 */
export function WithdrawModal({
  open,
  onOpenChange,
  projectName,
  committedUSD,
  recipientWallet,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectName: string;
  committedUSD: number;
  /** On-chain recipient wallet for the project. If absent, submit is disabled. */
  recipientWallet?: string;
  onSuccess?: () => void;
}) {
  const [raw, setRaw] = useState(String(Math.round(committedUSD * 0.25)));
  const [submitting, setSubmitting] = useState(false);
  const { confirm, error: toastError } = useToast();
  const client = useKommitProgram();

  useEffect(() => {
    if (open) setRaw(String(Math.round(committedUSD * 0.25)));
  }, [open, committedUSD]);

  const numeric = parseFloat(raw) || 0;
  const overMax = numeric > committedUSD;
  const isOnChain = !!recipientWallet;
  const walletReady = !!client;
  const submitDisabled =
    !isOnChain || !walletReady || overMax || numeric <= 0 || submitting;

  const submitHelp = !isOnChain
    ? "Withdraw isn't available for this project."
    : !walletReady
      ? "Sign in to withdraw."
      : null;

  const handleSubmit = async () => {
    if (!client || !recipientWallet || overMax || numeric <= 0) return;
    setSubmitting(true);
    try {
      await withdrawFromProject(client, new PublicKey(recipientWallet), raw);
      onOpenChange(false);
      setSubmitting(false);
      setTimeout(() => confirm("Withdraw confirmed."), 220);
      onSuccess?.();
    } catch (e) {
      setSubmitting(false);
      const mapped = mapAnchorError(e);
      // eslint-disable-next-line no-console
      console.warn("withdraw failed:", e);
      if (mapped.kind === "user_cancel") return;
      toastError(
        mapped.kind === "unknown" ? "Withdraw didn't go through." : mapped.title,
        mapped.kind === "unknown" ? "Try again." : mapped.detail,
        {
          recoveryLabel: "Try again",
          onRecover: () => void handleSubmit(),
        },
      );
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Withdraw from ${projectName}`}
      shadow="default"
    >
      <div className="mt-6 bg-gray-100 border-[3px] border-black p-4">
        <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest">
          Currently committed
        </div>
        <div className="mt-1 font-epilogue font-black text-4xl md:text-5xl tracking-tighter">
          {formatUSD(committedUSD)}
        </div>
      </div>

      <div className="mt-6">
        <label className="block font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest mb-2">
          Withdraw amount
        </label>
        <div className="flex items-stretch border-[3px] border-black bg-white shadow-brutal focus-within:translate-x-[-2px] focus-within:translate-y-[-2px] focus-within:shadow-[6px_6px_0px_0px_rgba(153,69,255,1)] transition-all">
          <span className="px-4 flex items-center font-epilogue font-black text-3xl text-gray-400">
            $
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={raw}
            onChange={(e) => setRaw(e.target.value.replace(/[^0-9.]/g, ""))}
            className="flex-1 px-2 py-3 font-epilogue font-black text-3xl bg-transparent outline-none min-w-0 tracking-tight w-full"
            aria-label="Withdraw amount"
            disabled={submitting}
          />
        </div>
        <div className="mt-3 flex gap-2 flex-wrap">
          {PERCENT_PRESETS.map((p) => {
            const value = Math.round(committedUSD * p);
            const isMax = p === 1;
            const isActive = numeric === value;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setRaw(String(value))}
                disabled={submitting}
                className={cn(
                  "font-epilogue font-black uppercase tracking-tight text-xs px-3 py-2 border-[2px] border-black shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform disabled:opacity-50 disabled:pointer-events-none",
                  isActive
                    ? "bg-primary text-white"
                    : isMax
                      ? "bg-black text-white"
                      : "bg-white text-black",
                )}
              >
                {isMax ? "Max" : `${Math.round(p * 100)}%`}
              </button>
            );
          })}
        </div>
        {overMax ? (
          <p className="mt-3 font-epilogue font-bold uppercase text-[11px] text-primary tracking-widest">
            Over your committed amount.
          </p>
        ) : null}
      </div>

      <div className="mt-5 bg-secondary border-[3px] border-black p-4 shadow-brutal">
        <p className="font-epilogue font-black uppercase text-xs leading-relaxed tracking-tight">
          Your lifetime kommits stay · Withdraw without penalty
        </p>
      </div>

      <div className="mt-5">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitDisabled}
          className="w-full bg-black text-white font-epilogue font-black uppercase tracking-tight text-lg py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-[6px_6px_0px_0px_rgba(20,241,149,1)] flex items-center justify-center gap-3 disabled:opacity-50 disabled:pointer-events-none"
        >
          {submitting ? (
            <>
              <span className="material-symbols-outlined font-bold animate-spin">progress_activity</span>
              Signing…
            </>
          ) : (
            <>
              <span className="material-symbols-outlined font-bold rotate-180">arrow_forward</span>
              Withdraw {formatUSD(numeric)}
            </>
          )}
        </button>
        {submitHelp ? (
          <p className="mt-3 font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest text-center">
            {submitHelp}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
