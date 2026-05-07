"use client";

import { useState } from "react";
import { Tape } from "@/components/common/Tape";
import { CommitModal } from "@/components/commit/CommitModal";
import { WithdrawModal } from "@/components/commit/WithdrawModal";
import { SignInModal } from "@/components/auth/SignInModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { kommitsFor, formatNumber, formatUSD } from "@/lib/kommit-math";
import { shortDate } from "@/lib/date-utils";
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
    return (
      <div className="bg-white border-[3px] border-black shadow-brutal-purple p-6 md:p-8 relative">
        <Tape color="black" size="md" rotation={12} className="absolute -top-3 -right-3" />
        <Tape color="secondary" size="md" rotation={-12} className="absolute -bottom-3 -left-3" />
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
        <Tape color="black" size="md" rotation={12} className="absolute -top-3 -right-3" />
        <Tape color="secondary" size="md" rotation={-12} className="absolute -bottom-3 -left-3" />

        <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest mb-2">
          Your position
        </div>
        {variant === "active" && committedUSD && sinceISO ? (
          <>
            <div className="font-epilogue font-black text-5xl md:text-6xl tracking-tighter">
              {formatUSD(committedUSD)}
              <span className="text-gray-400 text-xl ml-2">committed</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-5">
              <span className="bg-white border-[2px] border-black px-3 py-1 shadow-brutal-sm font-epilogue font-black uppercase text-xs tracking-tight">
                Active since {shortDate(sinceISO)}
              </span>
              <span className="bg-primary text-white border-[2px] border-black px-3 py-1 shadow-brutal-sm font-epilogue font-black uppercase text-xs tracking-tight">
                {formatNumber(kommitsFor(committedUSD, sinceISO))} kommits
              </span>
            </div>
          </>
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
            // Pass-2 P1 #11: disabled visual demoted (no offset shadow, grey border,
            // lower fill opacity). Stops the WITHDRAW button reading as pressable
            // when the user has no position.
            className="bg-white text-black font-epilogue font-black uppercase tracking-tight text-base py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none disabled:shadow-none disabled:border-gray-300"
          >
            <Icon name="remove" size="sm" />
            Withdraw
          </button>
        </div>

        <p className="mt-4 font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest text-center">
          Withdraw anytime · No fees
        </p>
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
          committedUSD={committedUSD}
          recipientWallet={project.recipientWallet}
          onSuccess={onTxSuccess}
        />
      ) : null}
      <SignInModal open={signInOpen} onOpenChange={setSignInOpen} />
    </>
  );
}
