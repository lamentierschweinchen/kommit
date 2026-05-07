"use client";

import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { Modal } from "@/components/common/Modal";
import { useToast } from "@/components/common/ToastProvider";
import { useKommitProgram } from "@/lib/anchor-client";
import { commitToProject } from "@/lib/tx";
import { mapAnchorError } from "@/lib/anchor-errors";
import { avatarUrl } from "@/lib/data/users";
import { formatUSD } from "@/lib/kommit-math";
import { parseTokenAmount, validateAmount } from "@/lib/money";
import { cn } from "@/lib/cn";
import type { Project } from "@/lib/data/projects";
import { Icon } from "@/components/common/Icon";

// USDC has 6 decimals on Solana. Mirror of `tx.ts:USDC_DECIMALS`; kept local
// so this UI module doesn't reach into the tx layer just for the constant.
const USDC_DECIMALS = 6;
const USDC_DECIMALS_DIVISOR = 10n ** BigInt(USDC_DECIMALS);

// Codex L1: comparisons run on exact bigint base units; the dollar literals
// here exist only to mint the matching base-unit constants below.
const QUICK_AMOUNTS = [50, 100, 500] as const;
const QUICK_AMOUNTS_BASE = QUICK_AMOUNTS.map(
  (n) => BigInt(n) * USDC_DECIMALS_DIVISOR,
);
const MAX_AMOUNT = 5000;
const MAX_AMOUNT_BASE = BigInt(MAX_AMOUNT) * USDC_DECIMALS_DIVISOR;

export function CommitModal({
  open,
  onOpenChange,
  project,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  project: Project;
  /** Fires after a successful on-chain settle so callers can refresh reads. */
  onSuccess?: () => void;
}) {
  const [raw, setRaw] = useState("100.00");
  const [submitting, setSubmitting] = useState(false);
  const { confirm, error: toastError } = useToast();
  const client = useKommitProgram();

  useEffect(() => {
    if (open) setRaw("100.00");
  }, [open]);

  // Exact base-unit parse — disable + preset-active checks compare bigints
  // (Codex L1). 0n covers both the empty/zero case and the malformed-input
  // case (validateAmount surfaces the specific error string for display).
  let parsedBaseUnits: bigint = 0n;
  try {
    if (raw.trim().length > 0) parsedBaseUnits = parseTokenAmount(raw, USDC_DECIMALS);
  } catch {
    parsedBaseUnits = 0n;
  }
  const validationError = raw.trim().length > 0 ? validateAmount(raw, USDC_DECIMALS, MAX_AMOUNT_BASE) : null;

  // Display value — parseFloat is OK for the human-readable button label;
  // it never feeds into TX construction or boundary checks.
  const displayUSD = parseFloat(raw) || 0;

  const isOnChain = !!project.recipientWallet;
  const walletReady = !!client;
  const submitDisabled =
    !isOnChain || !walletReady || parsedBaseUnits === 0n || !!validationError || submitting;

  const submitHelp = !isOnChain
    ? "This project isn't open for kommitments yet."
    : !walletReady
      ? "Sign in to kommit."
      : validationError && raw.trim().length > 0
        ? validationError
        : null;

  const handleSubmit = async () => {
    if (!client || !project.recipientWallet) return;
    setSubmitting(true);
    try {
      await commitToProject(client, new PublicKey(project.recipientWallet), raw);
      onOpenChange(false);
      setSubmitting(false);
      setTimeout(() => confirm("Kommit confirmed."), 220);
      onSuccess?.();
    } catch (e) {
      setSubmitting(false);
      const mapped = mapAnchorError(e);
      // Always log raw for debugging; never show it to the user.
      // eslint-disable-next-line no-console
      console.warn("commit failed:", e);
      if (mapped.kind === "user_cancel") return;
      toastError(
        mapped.kind === "unknown" ? "Kommit didn't go through." : mapped.title,
        mapped.kind === "unknown" ? "Try again." : mapped.detail,
        {
          recoveryLabel: "Try again",
          onRecover: () => void handleSubmit(),
        },
      );
    }
  };

  const founder = project.founders[0];

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`Kommit to ${project.name}`}>
      <div className="mt-3 inline-flex items-center gap-2.5 bg-gray-100 px-3 py-1.5 border-[2px] border-black shadow-brutal-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl(founder.avatarSeed, 60)}
          alt=""
          className="w-6 h-6 border-[2px] border-black object-cover grayscale"
        />
        <span className="font-epilogue font-black uppercase text-xs tracking-tight">
          By {founder.name}
        </span>
      </div>

      <div className="mt-6">
        <label className="block font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest mb-2">
          Amount
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
            aria-label="Kommit amount"
            disabled={submitting}
          />
        </div>
        <div className="mt-3 flex gap-2 flex-wrap">
          {QUICK_AMOUNTS.map((a, i) => {
            const isActive = parsedBaseUnits === QUICK_AMOUNTS_BASE[i];
            return (
              <button
                key={a}
                type="button"
                onClick={() => setRaw(String(a))}
                disabled={submitting}
                className={cn(
                  "font-epilogue font-black uppercase tracking-tight text-xs px-3 py-2 border-[2px] border-black shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform disabled:opacity-50 disabled:pointer-events-none",
                  isActive ? "bg-primary text-white" : "bg-white text-black",
                )}
              >
                ${a}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setRaw(String(MAX_AMOUNT))}
            disabled={submitting}
            className={cn(
              "font-epilogue font-black uppercase tracking-tight text-xs px-3 py-2 border-[2px] border-black shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform disabled:opacity-50 disabled:pointer-events-none",
              parsedBaseUnits === MAX_AMOUNT_BASE ? "bg-primary text-white" : "bg-black text-white",
            )}
          >
            Max
          </button>
        </div>
      </div>

      <div className="mt-5 bg-gray-100 border-[3px] border-black p-4 space-y-2">
        <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest">
          What this does
        </div>
        <p className="text-sm font-medium text-gray-800 leading-relaxed">
          The team sees a real backer. Your kommits build the longer you stay.
        </p>
        <p className="text-sm font-medium text-gray-800 leading-relaxed">
          First access when they raise. Yours, even after you withdraw.
        </p>
      </div>

      <div className="mt-4 bg-secondary border-[3px] border-black p-4 shadow-brutal">
        <p className="font-epilogue font-black uppercase text-xs leading-relaxed tracking-tight">
          Withdraw anytime · No fees · Kommits stay yours
        </p>
      </div>

      <div className="mt-4 border-[3px] border-black bg-white p-4">
        <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest mb-2">
          Where your money goes
        </div>
        <p className="text-sm font-medium text-gray-800 leading-relaxed">
          Deposited into audited yield protocols.{" "}
          <a
            href="https://github.com/lamentierschweinchen/kommit/blob/main/RISK.md"
            target="_blank"
            rel="noreferrer noopener"
            className="font-bold text-primary underline decoration-2 underline-offset-2 hover:bg-primary hover:text-white"
          >
            Read how we handle funds and risks
          </a>
          .
        </p>
      </div>

      <div className="mt-5">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitDisabled}
          className="w-full bg-primary text-white font-epilogue font-black uppercase tracking-tight text-lg py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-3 disabled:opacity-50 disabled:pointer-events-none"
        >
          {submitting ? (
            <>
              Signing…
              <Icon name="progress_activity" className="font-bold animate-spin" />
            </>
          ) : (
            <>
              Kommit {formatUSD(displayUSD)}
              <Icon name="arrow_forward" className="font-bold" />
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
