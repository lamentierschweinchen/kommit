"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { Modal } from "@/components/common/Modal";
import { useToast } from "@/components/common/ToastProvider";
import { useKommitProgram } from "@/lib/anchor-client";
import { withdrawFromProject } from "@/lib/tx";
import { mapAnchorError } from "@/lib/anchor-errors";
import { formatUSD } from "@/lib/kommit-math";
import { formatTokenAmount, parseTokenAmount, validateAmount } from "@/lib/money";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/common/Icon";
import { useDemoMode } from "@/lib/demo-mode";
import { simulateWithdraw } from "@/lib/demo-engagement";
import { useAuth } from "@/components/auth/AuthProvider";
import { useVisaMode, formatEUR } from "@/lib/visa-mode";

// USDC has 6 decimals on Solana.
const USDC_DECIMALS = 6;
const USDC_DECIMALS_DIVISOR = 10n ** BigInt(USDC_DECIMALS);

// Codex L1: percent presets compose as exact bigint fractions of the user's
// committed base-unit balance — no Math.round on a float dollar value.
const PERCENT_PRESETS: { num: bigint; den: bigint; label: string }[] = [
  { num: 1n, den: 4n, label: "25%" },
  { num: 1n, den: 2n, label: "50%" },
  { num: 3n, den: 4n, label: "75%" },
  { num: 1n, den: 1n, label: "Max" },
];

/**
 * Audit fix #13: [25%] [50%] [75%] [Max] preset chips + custom amount input.
 * Pass 2: wired to on-chain `withdrawFromProject`. Escrow-only path; klend
 * redeem graph stays v1.5 scope.
 */
export function WithdrawModal({
  open,
  onOpenChange,
  projectName,
  projectSlug,
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
  /** Slug used to address the position in the demo store. */
  projectSlug?: string;
  onSuccess?: () => void;
}) {
  // The committed amount arrives as a JS number (queries.ts converts it for
  // display). Reconstruct base units exactly via parseTokenAmount on the
  // 6-decimal toFixed string — precise at any retail USDC scale, well within
  // u64 / 2^53.
  const committedBaseUnits = parseTokenAmount(committedUSD.toFixed(USDC_DECIMALS), USDC_DECIMALS);

  // Pre-compute the four preset base-unit values so chip clicks set the
  // input to the same string `parseTokenAmount` would round-trip back to.
  const presetBaseUnits = PERCENT_PRESETS.map(
    ({ num, den }) => (committedBaseUnits * num) / den,
  );
  const presetDecimals = presetBaseUnits.map((b) => formatTokenAmount(b, USDC_DECIMALS));

  const [raw, setRaw] = useState(presetDecimals[0] ?? "0");
  const [submitting, setSubmitting] = useState(false);
  const { confirm, error: toastError } = useToast();
  const client = useKommitProgram();
  const isDemo = useDemoMode();
  const isVisa = useVisaMode();
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (open) setRaw(presetDecimals[0] ?? "0");
    // presetDecimals derives from committedUSD; depend on that primitive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, committedUSD]);

  // Codex L1: parse to base units for exact bigint comparisons.
  let parsedBaseUnits: bigint = 0n;
  try {
    if (raw.trim().length > 0) parsedBaseUnits = parseTokenAmount(raw, USDC_DECIMALS);
  } catch {
    parsedBaseUnits = 0n;
  }
  const validationError =
    raw.trim().length > 0 ? validateAmount(raw, USDC_DECIMALS, committedBaseUnits) : null;
  const overMax = parsedBaseUnits > committedBaseUnits;

  // Display-only values; never feed into TX construction or boundary checks.
  const displayUSD = parseFloat(raw) || 0;

  const isOnChain = !!recipientWallet;
  const walletReady = isDemo ? !!user?.wallet : !!client;
  const submitDisabled =
    !isOnChain ||
    !walletReady ||
    parsedBaseUnits === 0n ||
    !!validationError ||
    submitting;

  const submitHelp = !isOnChain
    ? "Withdraw isn't available for this project."
    : !walletReady
      ? "Sign in to withdraw."
      : validationError && raw.trim().length > 0
        ? validationError
        : null;

  // Confirmation copy — visa-mode says "kommit position" since MoonPay
  // Commerce has no offramp endpoint. Honest framing per handoff 44:
  // withdraw stays on-chain, fiat off-ramp arrives in v1.
  const successTitle = isVisa
    ? `${formatEUR(displayUSD)} back in your kommit balance`
    : "Withdraw confirmed.";
  const successDetail = isVisa
    ? `Returned from ${projectName}. Your card is unaffected — withdrawals stay on-chain to your kommit wallet.`
    : `Returned ${formatUSD(displayUSD)} from ${projectName}.`;

  const handleSubmit = async () => {
    // Demo path mirrors CommitModal's: localStorage simulation + same toast +
    // recovery action; no Anchor / Privy call.
    if (isDemo) {
      if (!user?.wallet || !projectSlug || parsedBaseUnits === 0n || overMax) return;
      setSubmitting(true);
      await new Promise((r) => setTimeout(r, 350));
      simulateWithdraw({
        wallet: user.wallet,
        projectSlug,
        amountUSD: displayUSD,
      });
      onOpenChange(false);
      setSubmitting(false);
      setTimeout(
        () =>
          confirm(successTitle, successDetail, {
            recoveryLabel: "View dashboard",
            onRecover: () => router.push("/dashboard"),
          }),
        220,
      );
      onSuccess?.();
      return;
    }

    if (!client || !recipientWallet || parsedBaseUnits === 0n || overMax) return;
    setSubmitting(true);
    try {
      await withdrawFromProject(client, new PublicKey(recipientWallet), raw);
      onOpenChange(false);
      setSubmitting(false);
      setTimeout(
        () =>
          confirm(successTitle, successDetail, {
            recoveryLabel: "View dashboard",
            onRecover: () => router.push("/dashboard"),
          }),
        220,
      );
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
      title={isVisa ? `Withdraw from ${projectName}` : `Withdraw from ${projectName}`}
      shadow="default"
    >
      {isVisa ? (
        <p className="mt-3 font-epilogue font-medium text-sm text-gray-700 leading-relaxed border-l-[4px] border-primary pl-4">
          Funds return to your kommit balance. Your card is unaffected — fiat
          off-ramp arrives in v1.
        </p>
      ) : null}
      <div className="mt-6 bg-gray-100 border-[3px] border-black p-4">
        <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest">
          Currently committed
        </div>
        <div className="mt-1 font-epilogue font-black text-4xl md:text-5xl tracking-tighter">
          {isVisa ? formatEUR(committedUSD) : formatUSD(committedUSD)}
        </div>
      </div>

      <div className="mt-6">
        <label className="block font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest mb-2">
          {isVisa ? "Amount to return" : "Withdraw amount"}
        </label>
        <div className="flex items-stretch border-[3px] border-black bg-white shadow-brutal focus-within:translate-x-[-2px] focus-within:translate-y-[-2px] focus-within:shadow-[6px_6px_0px_0px_rgba(153,69,255,1)] transition-all">
          <span className="px-4 flex items-center font-epilogue font-black text-3xl text-gray-400">
            {isVisa ? "€" : "$"}
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
          {PERCENT_PRESETS.map((p, i) => {
            const isMax = p.num === p.den;
            const isActive = parsedBaseUnits === presetBaseUnits[i];
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => setRaw(presetDecimals[i])}
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
                {p.label}
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
              <Icon name="progress_activity" className="font-bold animate-spin" />
              {isVisa ? "Returning to your balance…" : "Signing…"}
            </>
          ) : (
            <>
              <Icon name="arrow_forward" className="font-bold rotate-180" />
              {isVisa
                ? `Withdraw ${formatEUR(displayUSD)} from kommit`
                : `Withdraw ${formatUSD(displayUSD)}`}
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
