"use client";

import { useState } from "react";
import { CommitModal } from "@/components/commit/CommitModal";
import { WithdrawModal } from "@/components/commit/WithdrawModal";
import { SignInModal } from "@/components/auth/SignInModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { kommitsFor, formatKommits, formatNumber, formatUSD } from "@/lib/kommit-math";
import { shortDate } from "@/lib/date-utils";
import { useLiveKommits, formatLiveKommits } from "@/lib/hooks/useLiveKommits";
import type { Project } from "@/lib/data/projects";
import { Icon } from "@/components/common/Icon";

export type PositionVariant = "active" | "graduated" | "no-position";

export function PositionCard({
  project,
  variant,
  committedUSD,
  sinceISO,
  sinceMs,
  graduatedRecord,
  onTxSuccess,
}: {
  project: Project;
  variant: PositionVariant;
  /** User's committed amount in this project — required for "active" variant */
  committedUSD?: number;
  sinceISO?: string;
  /** Millisecond-precision commit timestamp. Optional: when present, the live
   *  hook ticks from that exact moment instead of from midnight UTC of the
   *  `sinceISO` date — preventing fresh commits from showing up to ~24 hours
   *  of unearned accrual the moment they hit the dashboard. */
  sinceMs?: number;
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
  const [commitOpen, setCommitOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);

  // Signed-out + open project → "Sign in to kommit" CTA that opens the sign-in
  // modal directly (per platform-test Critical #3 + High #7). Signed-in + open
  // project → real commit modal. Signed-in + project not yet open on-chain →
  // disabled commit modal with "not open yet" copy.
  const handleKommitClick = () => {
    if (!isSignedIn) {
      setSignInOpen(true);
    } else {
      setCommitOpen(true);
    }
  };

  if (variant === "graduated" && graduatedRecord) {
    // Handoff 69 B8: kommits is the score, not dollars. For graduated rounds
    // the principal has done its work — the kommit count is the only number
    // worth being the headline. Dollar amount drops out entirely.
    return (
      <div className="bg-white border-[3px] border-black shadow-brutal-purple p-6 md:p-8 relative">
        <div className="absolute -top-3 left-6">
          <span className="inline-block bg-primary text-white font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black shadow-brutal-sm">
            Graduated
          </span>
        </div>
        <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest mb-2">
          Your record
        </div>
        <div className="font-epilogue font-black text-3xl md:text-4xl tracking-tighter text-primary tabular-nums">
          {formatNumber(graduatedRecord.finalKommitsKept)}
          <span className="text-gray-400 text-base ml-2">kommits</span>
        </div>
        <div className="mt-4 space-y-2 font-epilogue font-bold uppercase text-xs tracking-tight">
          <div className="text-gray-500">
            Active {shortDate(graduatedRecord.activeFromISO)} → {shortDate(graduatedRecord.activeToISO)}
          </div>
        </div>
        <p className="mt-5 text-sm font-medium text-gray-700 leading-relaxed">
          Your kommitter benefits are listed on this page. Check{" "}
          <span className="font-epilogue font-bold uppercase text-[11px] tracking-widest">
            /dashboard
          </span>{" "}
          to claim.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white border-[3px] border-black shadow-brutal-purple p-6 md:p-8 relative">
        {variant === "active" && committedUSD && sinceISO ? (
          <ActivePositionDisplay
            committedUSD={committedUSD}
            sinceISO={sinceISO}
            sinceMs={sinceMs}
          />
        ) : project.kommittersCount === 0 ? (
          <>
            <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest mb-2">
              Your position
            </div>
            <div className="font-epilogue font-black text-3xl md:text-4xl tracking-tighter">
              No kommitters yet.
            </div>
            <p className="mt-3 text-sm text-gray-700 leading-relaxed font-medium">
              Be the first kommitter to back {project.name}.
            </p>
          </>
        ) : (
          <>
            <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest mb-2">
              Your position
            </div>
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
        ) : project.state === "graduated" ? (
          // Graduated round: kommit CTA closes off — early backers earned their
          // rights, late visitors see the round is closed (no funnel into a
          // dead position). Withdraw stays available so anyone with a residual
          // position can still pull principal.
          <div className="mt-6 grid grid-cols-1 gap-3">
            <button
              type="button"
              disabled
              className="bg-white text-black font-epilogue font-black uppercase tracking-tight text-base py-4 border-[3px] border-gray-400 flex items-center justify-center gap-2 cursor-not-allowed opacity-70"
            >
              <Icon name="info" size="sm" />
              Round closed
            </button>
            <p className="text-center font-epilogue font-medium text-xs text-gray-600">
              Backers earned their rights below.
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
 *
 * Two-stat brutalist layout (handoff 56 #5): kommits on the left as the
 * live-ticking primary number, currently-committed principal on the right.
 * Both get the same border-[3px] / large-number treatment so they read as
 * peers — the previous "one big kommit count + tiny committed chip" was
 * doing no work for the user.
 */
function ActivePositionDisplay({
  committedUSD,
  sinceISO,
  sinceMs,
}: {
  committedUSD: number;
  sinceISO: string;
  sinceMs?: number;
}) {
  const liveKommits = useLiveKommits(committedUSD, sinceISO, sinceMs);
  // Until the visibility-effect mounts and triggers the first tick, show the
  // SSR-pinned demo number so the headline never reads "0.00". formatKommits
  // matches formatLiveKommits's compact rule (≥1M → "3.88M") so the value
  // doesn't visually jump on hydration.
  const kommitsDisplay =
    liveKommits > 0
      ? formatLiveKommits(liveKommits)
      : formatKommits(kommitsFor(committedUSD, sinceISO));
  const moneyDisplay = formatUSD(committedUSD);

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border-[3px] border-black p-4 shadow-brutal-sm">
          <div className="font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest">
            Your kommits
          </div>
          <div
            className="mt-2 font-epilogue font-black text-3xl md:text-4xl tracking-tighter tabular-nums text-primary"
            aria-live="polite"
          >
            {kommitsDisplay}
          </div>
        </div>
        <div className="bg-white border-[3px] border-black p-4 shadow-brutal-sm">
          <div className="font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest">
            Currently kommitted
          </div>
          <div className="mt-2 font-epilogue font-black text-3xl md:text-4xl tracking-tighter">
            {moneyDisplay}
          </div>
        </div>
      </div>
      <div className="mt-4 font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest">
        Active since {shortDate(sinceISO)}
      </div>
      <p className="mt-5 text-sm font-medium text-gray-700 leading-relaxed">
        <span className="font-epilogue font-bold uppercase text-[11px] tracking-widest text-black">
          How this number grows.
        </span>{" "}
        Every dollar committed accrues kommits over time (capital × time).
        Add or withdraw and the rate adjusts. Your score never resets —
        it&rsquo;s your verifiable record of conviction.
      </p>
    </>
  );
}
