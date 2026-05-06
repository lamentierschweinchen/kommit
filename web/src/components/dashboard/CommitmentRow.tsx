"use client";

import { useState } from "react";
import { WithdrawModal } from "@/components/commit/WithdrawModal";
import { kommitsFor, formatNumber, formatUSD } from "@/lib/kommit-math";
import { shortDate } from "@/lib/date-utils";
import { projectImageUrl, type Project } from "@/lib/data/projects";
import type { Commitment } from "@/lib/data/commitments";
import { cn } from "@/lib/cn";

export function CommitmentRow({
  commitment,
  project,
  onWithdrawSuccess,
}: {
  commitment: Commitment;
  project: Project;
  onWithdrawSuccess?: () => void;
}) {
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const isPivot = !!commitment.pivotedAtISO;
  const kommits = kommitsFor(commitment.kommittedUSD, commitment.sinceISO);
  const founder = project.founders[0];

  return (
    <>
      <article
        className={cn(
          "bg-white border-[3px] border-black p-5 grid grid-cols-1 md:grid-cols-[1.2fr_1fr_auto] gap-5 items-center relative",
          isPivot ? "shadow-brutal-purple" : "shadow-brutal",
        )}
      >
        {isPivot ? (
          <div className="absolute -top-3 left-6 z-10">
            {/* Audit fix #6: every pivoted commitment shows the inline tag persistently */}
            <span className="inline-block bg-primary text-white font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black shadow-brutal-sm">
              ↳ Pivoted {shortDate(commitment.pivotedAtISO!)}
            </span>
          </div>
        ) : null}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gray-900 border-[3px] border-black shrink-0 relative overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={projectImageUrl(project.imageSeed, 200, 200)}
              alt=""
              className="w-full h-full object-cover opacity-60"
            />
            <span className="absolute inset-0 flex items-center justify-center font-epilogue font-black text-white text-xs mix-blend-difference">
              {project.name.slice(0, 3).toUpperCase()}
            </span>
          </div>
          <div>
            <div className="font-epilogue font-black uppercase text-lg tracking-tight">
              {project.name}
            </div>
            <div className="text-sm font-medium text-gray-700">{project.pitch}</div>
            <div className="text-xs text-gray-500 mt-0.5">by {founder.name}</div>
          </div>
        </div>
        <div className="font-epilogue font-bold text-sm uppercase tracking-tight space-y-1">
          <div>
            Committed <span className="font-black text-base">{formatUSD(commitment.kommittedUSD)}</span>
          </div>
          <div className="text-gray-500">
            Since {shortDate(commitment.sinceISO)} · {formatNumber(kommits)} kommits
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setWithdrawOpen(true)}
            className="bg-white text-black font-epilogue font-black uppercase tracking-tight text-xs px-4 py-2 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform"
          >
            Withdraw
          </button>
        </div>
      </article>
      <WithdrawModal
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        projectName={project.name}
        committedUSD={commitment.kommittedUSD}
        recipientWallet={project.recipientWallet}
        onSuccess={onWithdrawSuccess}
      />
    </>
  );
}
