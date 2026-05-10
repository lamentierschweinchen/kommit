"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { CommitModal } from "@/components/commit/CommitModal";
import { WithdrawModal } from "@/components/commit/WithdrawModal";
import { kommitsFor, formatNumber, formatUSD } from "@/lib/kommit-math";
import { shortDate } from "@/lib/date-utils";
import { projectImageUrl, type Project } from "@/lib/data/projects";
import { useLiveKommits, formatLiveKommits } from "@/lib/hooks/useLiveKommits";
import { useVisaMode, formatEUR } from "@/lib/visa-mode";
import type { Commitment } from "@/lib/data/commitments";
import type { RemoteUpdate } from "@/lib/api-types";
import { findProjectPda } from "@/lib/kommit";
import { authedFetch } from "@/lib/api-client";
import { Icon } from "@/components/common/Icon";
import { cn } from "@/lib/cn";

export function CommitmentRow({
  commitment,
  project,
  onWithdrawSuccess,
}: {
  commitment: Commitment;
  project: Project;
  /** Fires after a successful withdraw OR top-up so callers can refresh. */
  onWithdrawSuccess?: () => void;
}) {
  const router = useRouter();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [commitOpen, setCommitOpen] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const isPivot = !!commitment.pivotedAtISO;

  useEffect(() => {
    if (!project.recipientWallet || typeof window === "undefined") return;
    let cancelled = false;
    let pda: string;
    try {
      pda = findProjectPda(new PublicKey(project.recipientWallet)).toBase58();
    } catch {
      return;
    }
    const lastSeen = localStorage.getItem(`kommit:lastSeen:${pda}`);
    authedFetch(`/api/projects/${pda}/updates`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("fetch failed"))))
      .then((j: { updates: RemoteUpdate[] }) => {
        if (cancelled) return;
        if (!lastSeen) {
          // First-time visitor — count nothing as "new" so we don't blanket-pill
          // every commitment after a P1.4 deploy. The pill becomes meaningful
          // after the kommitter has visited at least once.
          setNewCount(0);
          return;
        }
        const n = j.updates.filter((u) => u.posted_at > lastSeen).length;
        setNewCount(n);
      })
      .catch(() => {
        if (!cancelled) setNewCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [project.recipientWallet]);
  const liveKommits = useLiveKommits(
    commitment.kommittedUSD,
    commitment.sinceISO,
    commitment.sinceMs,
  );
  const kommitsDisplay =
    liveKommits > 0
      ? formatLiveKommits(liveKommits)
      : formatNumber(kommitsFor(commitment.kommittedUSD, commitment.sinceISO));
  const isVisa = useVisaMode();
  const moneyLabel = isVisa ? formatEUR(commitment.kommittedUSD) : formatUSD(commitment.kommittedUSD);
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
        {/* H5 — project name + image area links to the public page; the
            inner action buttons stop propagation so withdraw still works. */}
        <Link
          href={`/projects/${project.slug}`}
          className="flex items-center gap-4 group"
          aria-label={`View ${project.name}`}
        >
          <div className="w-16 h-16 bg-gray-900 border-[3px] border-black shrink-0 relative overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={projectImageUrl(project.imageSeed, 200, 200)}
              alt=""
              className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
            />
            <span className="absolute inset-0 flex items-center justify-center font-epilogue font-black text-white text-xs mix-blend-difference">
              {project.name.slice(0, 3).toUpperCase()}
            </span>
          </div>
          <div>
            <div className="font-epilogue font-black uppercase text-lg tracking-tight group-hover:underline">
              {project.name}
            </div>
            <div className="text-sm font-medium text-gray-700">{project.pitch}</div>
            <div className="text-xs text-gray-500 mt-0.5">by {founder.name}</div>
          </div>
        </Link>
        {/* H2 — kommits as the headline number; committed USD + since date drop to secondary chips. */}
        <div>
          <div className="font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest">
            Kommits
          </div>
          <div
            className="mt-1 font-epilogue font-black text-3xl md:text-4xl tracking-tighter tabular-nums"
            aria-live="polite"
          >
            {kommitsDisplay}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="inline-block bg-white border-[2px] border-black px-2 py-0.5 shadow-brutal-sm font-epilogue font-black uppercase text-[10px] tracking-widest">
              {moneyLabel} committed
            </span>
            <span className="inline-block bg-white border-[2px] border-black px-2 py-0.5 shadow-brutal-sm font-epilogue font-black uppercase text-[10px] tracking-widest">
              Since {shortDate(commitment.sinceISO)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {newCount > 0 ? (
            <span className="inline-block bg-primary text-white font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black shadow-brutal-sm">
              {newCount} New
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => {
              if (isVisa) {
                router.push(`/visa-demo?project=${project.slug}`);
                return;
              }
              setCommitOpen(true);
            }}
            className="bg-primary text-white font-epilogue font-black uppercase tracking-tight text-xs px-4 py-2 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform inline-flex items-center gap-1.5"
          >
            <Icon name="add" size="sm" />
            Kommit more
          </button>
          <button
            type="button"
            onClick={() => setWithdrawOpen(true)}
            className="bg-white text-black font-epilogue font-black uppercase tracking-tight text-xs px-4 py-2 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform"
          >
            {isVisa ? "Withdraw to card" : "Withdraw"}
          </button>
        </div>
      </article>
      <CommitModal
        open={commitOpen}
        onOpenChange={setCommitOpen}
        project={project}
        onSuccess={onWithdrawSuccess}
      />
      <WithdrawModal
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        projectName={project.name}
        projectSlug={project.slug}
        committedUSD={commitment.kommittedUSD}
        recipientWallet={project.recipientWallet}
        onSuccess={onWithdrawSuccess}
      />
    </>
  );
}
