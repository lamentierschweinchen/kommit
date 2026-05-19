"use client";

import { useEffect, useMemo, useState } from "react";
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
import { getSandboxMintOrNull } from "@/lib/sandbox-mint";
import { getSandboxProjects } from "@/lib/sandbox-projects";
import { computeFrozenKommits, recordWithdrawn } from "@/lib/withdrawn-overlay";
import { getProject } from "@/lib/data/projects";
import { useLiveKommits, formatLiveKommits } from "@/lib/hooks/useLiveKommits";

// USDC has 6 decimals on Solana.
const USDC_DECIMALS = 6;

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
 *
 * Handoff 81 (wave 4): three-change UX restructure on top of the v0.5 modal —
 *   1. dual-action sticky footer (Cancel beside Withdraw) so the only escape
 *      isn't the close-X (32×32, sub-44pt; wave 2 widened it on the Modal
 *      shell but Cancel-as-button is the canonical brutalist affordance);
 *   2. "After this withdraw" split block — shows principal-back-to-wallet and
 *      kommits-stay-on-record at a glance, updating per keystroke so the
 *      withdraw amount's downstream effects are visible without scrolling;
 *   3. "Your position" block — surfaces the live kommit count and, when
 *      relevant, a separate frozen-segment line so kommitters who landed
 *      here post-rekommit (additive accrual, PR #62) can tell active vs.
 *      frozen apart.
 */
export function WithdrawModal({
  open,
  onOpenChange,
  projectName,
  projectSlug,
  committedUSD,
  recipientWallet,
  sinceISO,
  sinceMs,
  frozenKommits,
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
  /** Original commit date — used to snapshot frozen kommits in real-Privy
   *  mode when a full withdraw closes the on-chain account. */
  sinceISO?: string;
  /** Millisecond-precision commit timestamp. Same purpose as sinceISO; more
   *  accurate when present. */
  sinceMs?: number;
  /** Lifetime accumulator from prior withdraw cycles. Additive with the live
   *  ticker (see useLiveKommits). Wave 4 surfaces this as a separate line in
   *  the "Your position" block when > 0 so a re-kommitted user can see what's
   *  active (still accruing) vs. frozen (last withdraw snapshot). */
  frozenKommits?: number;
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
  // Handoff 78 P2-2 / wave 6: which preset chip was tapped most recently. We
  // highlight by user intent, not by bigint equality, so typing $125.5 doesn't
  // make the 25% chip "feel arbitrary." Cleared on any manual edit; reset to
  // the 25% chip on modal open below.
  const [pickedPresetIdx, setPickedPresetIdx] = useState<number | null>(0);
  const [submitting, setSubmitting] = useState(false);
  const { confirm, error: toastError } = useToast();
  const client = useKommitProgram();
  const isDemo = useDemoMode();
  const { user } = useAuth();
  const router = useRouter();

  // On-chain demo path (real Privy): swap to the sandbox recipient + mint
  // when the project has a sandbox-projects entry. Mirrors CommitModal's
  // swap so a position kommitted via /sandbox or the on-chain demo entry
  // can be withdrawn against the same sandbox-locked escrow.
  const sandboxMint = useMemo(() => (isDemo ? null : getSandboxMintOrNull()), [
    isDemo,
  ]);
  const sandboxProject = useMemo(() => {
    if (isDemo) return null;
    if (!sandboxMint) return null;
    if (!projectSlug) return null;
    return getSandboxProjects().find((p) => p.slug === projectSlug) ?? null;
  }, [isDemo, projectSlug, sandboxMint]);

  useEffect(() => {
    if (open) {
      setRaw(presetDecimals[0] ?? "0");
      // Reset picked-preset to the default (25%) on each open so the chip
      // active state matches the input value at modal mount.
      setPickedPresetIdx(0);
    }
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
  const remainingUSD = Math.max(0, committedUSD - displayUSD);
  const isFullWithdraw =
    parsedBaseUnits > 0n && parsedBaseUnits === committedBaseUnits;
  const hasValidAmount =
    parsedBaseUnits > 0n && !overMax && !validationError;

  // Live kommit ticker for the "Your position" block. Cap accrual at
  // graduation if applicable — mirrors CommitmentRow's freezeAtMs derivation
  // so the number in the modal matches what the user just saw on the
  // dashboard tile. Frozen segment is additive (see useLiveKommits) — when
  // committedUSD == 0 the formula returns just `frozenKommits`, so a
  // post-full-withdraw position with the modal opened from /dashboard's
  // WITHDRAWN row would already read correctly. (That row hides the
  // Withdraw CTA today; this guard future-proofs the block.)
  const project = projectSlug ? getProject(projectSlug) : undefined;
  const graduatedAtMs = project?.graduatedAtISO
    ? new Date(`${project.graduatedAtISO}T00:00:00Z`).getTime()
    : undefined;
  // Hooks must run unconditionally — pass a fallback ISO that's a no-op
  // when `sinceISO` is absent (a defensive case; both production callers pass
  // it). `sinceMs ?? Date.now()` short-circuits the parse-from-string path in
  // the hook, and an `usdAmount=0` block (below) prevents NaN bleed into the
  // display when committed is zero AND frozen is absent.
  const liveKommits = useLiveKommits(
    committedUSD,
    sinceISO ?? "2026-01-01",
    sinceMs,
    graduatedAtMs,
    frozenKommits,
  );
  // Active (still-accruing) portion = total − frozen. With committedUSD=0
  // the live formula returns frozen only, so active = 0 ✓.
  const activeKommits = Math.max(0, liveKommits - (frozenKommits ?? 0));
  const hasFrozenSegment = (frozenKommits ?? 0) > 0;

  // Projected kommits after this withdraw. Partial withdraws keep accruing on
  // the remaining principal — so the *count* doesn't drop instantly; what
  // drops is the accrual rate. Full withdraws freeze the count at its current
  // value. Either way the displayed kommit-count for "stays on your record"
  // is the current live total — the truthful number, not a guess at the
  // future. Copy clarifies whether it keeps moving or stops here.
  const kommitsStayDisplay = liveKommits > 0 ? formatLiveKommits(liveKommits) : "0";

  const isOnChain = !!recipientWallet || !!sandboxProject;
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

  const successTitle = "Withdraw confirmed.";
  const successDetail = `Returned ${formatUSD(displayUSD)} from ${projectName}.`;

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

    if (!client || parsedBaseUnits === 0n || overMax) return;
    const recipient: PublicKey | null = sandboxProject
      ? sandboxProject.recipientWallet
      : recipientWallet
        ? new PublicKey(recipientWallet)
        : null;
    if (!recipient) return;

    // Real-Privy full-withdraw snapshot. The on-chain account closes when
    // principal hits zero — without this overlay write, the row disappears
    // from /dashboard and the lifetime kommits stat regresses. Compute the
    // frozen-kommit snapshot from the position metadata BEFORE the tx
    // fires; persist it to localStorage so queries.ts can surface it after
    // the close. Cap accrual at graduation if applicable.
    if (
      isFullWithdraw &&
      user?.wallet &&
      projectSlug &&
      sinceMs != null &&
      sinceISO
    ) {
      const proj = getProject(projectSlug);
      const snapshotFrozen = computeFrozenKommits({
        committedUSD,
        sinceMs,
        graduatedAtISO: proj?.graduatedAtISO,
      });
      recordWithdrawn(user.wallet, projectSlug, {
        sinceISO,
        sinceMs,
        frozenKommits: snapshotFrozen,
        withdrawnAtMs: Date.now(),
      });
    }

    setSubmitting(true);
    try {
      await withdrawFromProject(client, recipient, raw, sandboxMint ?? undefined);
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

  // Wave 4 — dual-action footer. Mirrors CommitModal's wave-1 sticky-footer
  // pattern (Modal.tsx `footer` slot) so the action stays in thumb-reach
  // when the mobile keyboard is open. Equal-width 50/50 split, both ≥44pt:
  //   - Cancel (outline white/black) — explicit escape, replaces a sole
  //     reliance on the 44×44 close-X (wave 2 widened it but a labelled
  //     button is the canonical affordance).
  //   - Withdraw (filled black w/ green-shadow accent) — primary, keeps the
  //     destructive-action visual treatment from BrutalButton/destructive
  //     plus the existing rotated `arrow_forward` glyph.
  // Both buttons skip the standard hover-lift so the two-button row doesn't
  // shift sideways on hover; the active-press translate stays as the
  // tactile cue.
  const footer = (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => onOpenChange(false)}
        disabled={submitting}
        className="w-full min-h-[44px] bg-white text-black font-epilogue font-black uppercase tracking-tight text-base md:text-lg py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:bg-gray-50 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitDisabled}
        className="w-full min-h-[44px] bg-black text-white font-epilogue font-black uppercase tracking-tight text-base md:text-lg py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-[6px_6px_0px_0px_rgba(20,241,149,1)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
      >
        {submitting ? (
          <>
            <Icon name="progress_activity" className="font-bold animate-spin" />
            Signing…
          </>
        ) : (
          <>
            <Icon name="arrow_forward" className="font-bold rotate-180" />
            Withdraw {formatUSD(displayUSD)}
          </>
        )}
      </button>
      {submitHelp ? (
        <p className="col-span-2 mt-1 font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest text-center">
          {submitHelp}
        </p>
      ) : null}
    </div>
  );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Withdraw from ${projectName}`}
      shadow="default"
      footer={footer}
    >
      {/* "Your position" — replaces the v0.5 single-stat "Currently committed"
          block. Two states:
            - active + (optional) frozen segment, when committedUSD > 0
            - frozen-only fallback, when committedUSD == 0 and frozen > 0
              (defensive: this surface is reachable only from the
              still-accruing rows today; the WITHDRAWN row hides the CTA.) */}
      <div className="mt-6 bg-gray-100 border-[3px] border-black p-4">
        <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest">
          Your position
        </div>
        {committedUSD > 0 ? (
          <>
            <div className="mt-1 flex items-baseline gap-3 flex-wrap">
              <div className="font-epilogue font-black text-4xl md:text-5xl tracking-tighter tabular-nums">
                {formatUSD(committedUSD)}
              </div>
              <div className="font-epilogue font-bold uppercase text-[11px] text-gray-600 tracking-widest">
                active ·{" "}
                <span className="text-primary tabular-nums">
                  {activeKommits > 0 ? formatLiveKommits(activeKommits) : "0"}
                </span>{" "}
                kommits accruing
              </div>
            </div>
            {hasFrozenSegment ? (
              <div className="mt-2 pt-2 border-t-[2px] border-gray-300 font-epilogue font-bold uppercase text-[11px] text-gray-600 tracking-widest">
                +{" "}
                <span className="text-black tabular-nums">
                  {formatLiveKommits(frozenKommits ?? 0)}
                </span>{" "}
                kommits frozen from earlier commits
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div className="mt-1 font-epilogue font-black text-2xl md:text-3xl tracking-tighter">
              Position closed
            </div>
            {hasFrozenSegment ? (
              <div className="mt-2 font-epilogue font-bold uppercase text-[11px] text-gray-600 tracking-widest">
                <span className="text-black tabular-nums">
                  {formatLiveKommits(frozenKommits ?? 0)}
                </span>{" "}
                kommits frozen on your record
              </div>
            ) : null}
          </>
        )}
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
            onChange={(e) => {
              setRaw(e.target.value.replace(/[^0-9.]/g, ""));
              // Manual edit clears the picked-preset state so the chip
              // doesn't claim ownership of an amount the user typed by hand.
              setPickedPresetIdx(null);
            }}
            className="flex-1 px-2 py-3 font-epilogue font-black text-3xl bg-transparent outline-none min-w-0 tracking-tight w-full"
            aria-label="Withdraw amount"
            disabled={submitting}
          />
        </div>
        <div className="mt-3 flex gap-2 flex-wrap">
          {PERCENT_PRESETS.map((p, i) => {
            const isMax = p.num === p.den;
            // Handoff 78 P2-2 / wave 6: chip-active state tracks what the user
            // tapped, not bigint-equality on parsed input. Typing $125.5
            // doesn't make a chip light up; tapping a chip activates that
            // chip and overwrites the input.
            const isActive = pickedPresetIdx === i;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setRaw(presetDecimals[i]);
                  setPickedPresetIdx(i);
                }}
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

      {/* "After this withdraw" — the consequence block. Three states:
           - hasValidAmount + isFullWithdraw  → kommits stay frozen
           - hasValidAmount + partial         → kommits keep accruing on remaining
           - !hasValidAmount                  → muted placeholder
         Visually distinct from the input section (purple-shadow shows action
         in progress; this is decoration-light + monospace numerals so the
         eye reads it as "this is the consequence, not what you're entering"). */}
      <div className="mt-5 border-[3px] border-black bg-white p-4">
        <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest">
          After this withdraw
        </div>
        {hasValidAmount ? (
          <div className="mt-3 grid grid-cols-2 gap-3 divide-x-[2px] divide-gray-300">
            <div className="pr-3">
              <div className="font-epilogue font-black text-2xl md:text-3xl tracking-tighter tabular-nums">
                {formatUSD(displayUSD)}
              </div>
              <div className="mt-1 font-epilogue font-bold uppercase text-[10px] text-gray-600 tracking-widest leading-snug">
                returns to your wallet
              </div>
            </div>
            <div className="pl-3">
              <div className="font-epilogue font-black text-2xl md:text-3xl tracking-tighter tabular-nums text-primary">
                {kommitsStayDisplay}
              </div>
              <div className="mt-1 font-epilogue font-bold uppercase text-[10px] text-gray-600 tracking-widest leading-snug">
                {isFullWithdraw
                  ? "kommits stay frozen on your record"
                  : `kommits keep accruing on ${formatUSD(remainingUSD)}`}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-2 font-epilogue font-medium text-sm text-gray-500 leading-snug">
            Enter an amount above to preview what moves where.
          </p>
        )}
      </div>

      <div className="mt-5 bg-secondary border-[3px] border-black p-4 shadow-brutal">
        <p className="font-epilogue font-black uppercase text-xs leading-relaxed tracking-tight">
          Your lifetime kommits stay · Withdraw without penalty
        </p>
      </div>
    </Modal>
  );
}
