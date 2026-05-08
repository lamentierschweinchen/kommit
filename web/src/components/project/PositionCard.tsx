"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CommitModal } from "@/components/commit/CommitModal";
import { WithdrawModal } from "@/components/commit/WithdrawModal";
import { SignInModal } from "@/components/auth/SignInModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { kommitsFor, formatNumber, formatUSD } from "@/lib/kommit-math";
import { daysBetween, shortDate } from "@/lib/date-utils";
import { useLiveKommits, formatLiveKommits } from "@/lib/hooks/useLiveKommits";
import { useVisaMode, formatEUR } from "@/lib/visa-mode";
import type { Project } from "@/lib/data/projects";
import { Icon } from "@/components/common/Icon";

export type PositionVariant = "active" | "graduated" | "no-position";

export function PositionCard({
  project,
  variant,
  committedUSD,
  sinceISO,
  graduatedRecord,
  onTxSuccess,
}: {
  project: Project;
  variant: PositionVariant;
  /** User's committed amount in this project — required for "active" variant */
  committedUSD?: number;
  sinceISO?: string;
  /** Graduated archival record */
  graduatedRecord?: {
    finalKommitsKept: number;
    activeFromISO: string;
    activeToISO: string;
  };
  /** Fires after a successful kommit/withdraw so caller can refresh reads. */
  onTxSuccess?: () => void;
}) {
  const { isSignedIn } = useAuth();
  const isVisa = useVisaMode();
  const router = useRouter();
  const [commitOpen, setCommitOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);

  // Signed-out + open project → "Sign in to kommit" CTA that opens the sign-in
  // modal directly (per platform-test Critical #3 + High #7). Signed-in + open
  // project → real commit modal. Signed-in + project not yet open on-chain →
  // disabled commit modal with "not open yet" copy.
  // Visa mode → re-route through the card flow so the user re-confirms the
  // amount + sees the "card was charged" success state again.
  const handleKommitClick = () => {
    if (isVisa) {
      router.push(`/visa-demo?project=${project.slug}`);
      return;
    }
    if (!isSignedIn) {
      setSignInOpen(true);
    } else {
      setCommitOpen(true);
    }
  };

  if (variant === "graduated" && graduatedRecord) {
    return (
      <div className="bg-white border-[3px] border-black shadow-brutal-purple p-6 md:p-8 relative">
        <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest mb-2">
          Your record
        </div>
        <div className="font-epilogue font-black text-3xl md:text-4xl tracking-tighter">
          {formatUSD(committedUSD ?? 0)}
          <span className="text-gray-400 text-base ml-2">kommitted (returned)</span>
        </div>
        <div className="mt-4 space-y-2 font-epilogue font-bold uppercase text-xs tracking-tight">
          <div className="text-gray-500">
            Active {shortDate(graduatedRecord.activeFromISO)} → {shortDate(graduatedRecord.activeToISO)}
          </div>
          <div className="text-primary">
            {formatNumber(graduatedRecord.finalKommitsKept)} final kommits
          </div>
          <div className="text-gray-500">First access: invited Apr 28</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white border-[3px] border-black shadow-brutal-purple p-6 md:p-8 relative">
        <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest mb-2">
          Your position
        </div>
        {variant === "active" && committedUSD && sinceISO ? (
          <ActivePositionDisplay committedUSD={committedUSD} sinceISO={sinceISO} />
        ) : project.kommittersCount === 0 ? (
          <>
            <div className="font-epilogue font-black text-3xl md:text-4xl tracking-tighter">
              No kommitters yet.
            </div>
            <p className="mt-3 text-sm text-gray-700 leading-relaxed font-medium">
              Be the first kommitter to back {project.name}.
            </p>
          </>
        ) : (
          <>
            <div className="font-epilogue font-black text-2xl md:text-3xl tracking-tighter">
              Back {project.name}.
            </div>
            <p className="mt-3 text-sm text-gray-700 leading-relaxed font-medium">
              {formatNumber(project.kommittersCount)} kommitters · {formatUSD(project.totalKommittedUSD, { compact: true })} total committed
            </p>
          </>
        )}

        {!project.recipientWallet ? (
          <div className="mt-6 grid grid-cols-1 gap-3">
            <button
              type="button"
              disabled
              className="bg-secondary text-black font-epilogue font-black uppercase tracking-tight text-base py-4 border-[3px] border-black shadow-brutal-sm flex items-center justify-center gap-2 cursor-not-allowed opacity-90"
            >
              <Icon name="info" size="sm" />
              Launching soon
            </button>
            <p className="text-center font-epilogue font-medium text-xs text-gray-600">
              Kommitments open when {project.name} goes live.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mt-6">
            <button
              type="button"
              onClick={handleKommitClick}
              className="bg-primary text-white font-epilogue font-black uppercase tracking-tight text-base py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2"
            >
              <Icon name="add" size="sm" />
              Kommit
            </button>
            <button
              type="button"
              onClick={() => (isSignedIn ? setWithdrawOpen(true) : setSignInOpen(true))}
              disabled={variant !== "active"}
              className="bg-white text-black font-epilogue font-black uppercase tracking-tight text-base py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none disabled:shadow-none disabled:border-gray-300"
            >
              <Icon name="remove" size="sm" />
              Withdraw
            </button>
          </div>
        )}

      </div>

      <CommitModal
        open={commitOpen}
        onOpenChange={setCommitOpen}
        project={project}
        onSuccess={onTxSuccess}
      />
      {variant === "active" && committedUSD ? (
        <WithdrawModal
          open={withdrawOpen}
          onOpenChange={setWithdrawOpen}
          projectName={project.name}
          projectSlug={project.slug}
          committedUSD={committedUSD}
          recipientWallet={project.recipientWallet}
          onSuccess={onTxSuccess}
        />
      ) : null}
      <SignInModal
        open={signInOpen}
        onOpenChange={setSignInOpen}
        title={`Sign in to back ${project.name}`}
      />
    </>
  );
}

/**
 * Active-position display block. Pulled into its own component so the
 * `useLiveKommits` hook runs unconditionally — React hooks can't sit inside
 * a conditional branch in the parent.
 */
function ActivePositionDisplay({
  committedUSD,
  sinceISO,
}: {
  committedUSD: number;
  sinceISO: string;
}) {
  const liveKommits = useLiveKommits(committedUSD, sinceISO);
  const isVisa = useVisaMode();
  // Until the visibility-effect mounts and triggers the first tick, show the
  // SSR-pinned demo number so the headline never reads "0.00".
  const display = liveKommits > 0
    ? formatLiveKommits(liveKommits)
    : formatNumber(kommitsFor(committedUSD, sinceISO));

  return (
    <>
      <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest mb-1">
        Your kommits
      </div>
      <div
        className="font-epilogue font-black text-5xl md:text-6xl tracking-tighter tabular-nums"
        aria-live="polite"
      >
        {display}
      </div>
      <div className="flex flex-wrap gap-2 mt-5">
        <span className="bg-white border-[2px] border-black px-3 py-1 shadow-brutal-sm font-epilogue font-black uppercase text-xs tracking-tight">
          Active since {shortDate(sinceISO)}
        </span>
        <span className="bg-primary text-white border-[2px] border-black px-3 py-1 shadow-brutal-sm font-epilogue font-black uppercase text-xs tracking-tight">
          {isVisa ? formatEUR(committedUSD) : formatUSD(committedUSD)} currently committed
        </span>
      </div>
      <p className="mt-5 text-sm font-medium text-gray-700 leading-relaxed">
        <span className="font-epilogue font-bold uppercase text-[11px] tracking-widest text-black">
          How this number grows.
        </span>{" "}
        {isVisa ? (
          <>
            Every euro on your card stays earning kommits while it&rsquo;s
            committed. Add to it or pull it back any time — your score never
            resets. It&rsquo;s your verifiable record of conviction.
          </>
        ) : (
          <>
            Every dollar committed accrues kommits over time (capital × time).
            Add or withdraw and the rate adjusts. Your score never resets —
            it&rsquo;s your verifiable record of conviction.
          </>
        )}
      </p>
    </>
  );
}
