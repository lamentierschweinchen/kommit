"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PublicKey } from "@solana/web3.js";
import { CommitModal } from "@/components/commit/CommitModal";
import { CommitChooserModal } from "@/components/commit/CommitChooserModal";
import { WithdrawModal } from "@/components/commit/WithdrawModal";
import { BrutalButton } from "@/components/common/BrutalButton";
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
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [commitOpen, setCommitOpen] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
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
          // Pass-3 layout fix (Option A): two-zone single-row.
          // Image (shrink-0) | info zone (flex-1 min-w-0, name/pitch/meta) |
          // right zone (shrink-0, stat above actions, items-end).
          // Stacks vertically at narrow widths.
          "bg-white border-[3px] border-black p-5 relative",
          "flex flex-col md:flex-row md:items-center gap-4 md:gap-6",
          isPivot ? "shadow-brutal-purple mt-3" : "shadow-brutal",
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

        {/* IMAGE — fixed 64×64. Linked, but the info zone has its own link below
            so the click target on the name + pitch reads as the same affordance. */}
        <Link
          href={`/projects/${project.slug}`}
          className="shrink-0 group block"
          aria-label={`View ${project.name}`}
          tabIndex={-1}
        >
          <div className="w-16 h-16 bg-gray-900 border-[3px] border-black overflow-hidden relative">
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
        </Link>

        {/* INFO ZONE — flex-1 min-w-0 lets the truncate / line-clamp actually
            kick in instead of pushing the row width past the viewport. */}
        <Link
          href={`/projects/${project.slug}`}
          className="flex-1 min-w-0 group"
        >
          <div className="font-epilogue font-black uppercase text-lg tracking-tight truncate group-hover:underline">
            {project.name}
          </div>
          <div className="mt-0.5 text-sm font-medium text-gray-700 line-clamp-1">
            {project.pitch}
          </div>
          <div className="mt-1 text-xs font-medium text-gray-500 truncate">
            by {founder.name} · since {shortDate(commitment.sinceISO)}
          </div>
        </Link>

        {/* RIGHT ZONE — stat above actions, both right-aligned at md+,
            left-aligned (default flex-col) on narrow viewports. */}
        <div className="shrink-0 flex flex-col md:items-end gap-3">
          <div className="text-left md:text-right">
            <div
              className="font-epilogue font-black text-2xl md:text-3xl tracking-tighter tabular-nums leading-none"
              aria-live="polite"
            >
              {kommitsDisplay}
            </div>
            <div className="mt-1 font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest">
              kommits · {moneyLabel} committed
            </div>
          </div>

          <div className="flex items-center gap-2">
            {newCount > 0 ? (
              <span className="inline-block bg-primary text-white font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black shadow-brutal-sm">
                {newCount} new
              </span>
            ) : null}
            <BrutalButton
              size="xs"
              variant="primary"
              iconLeft={<Icon name="add" size="xs" />}
              onClick={() => {
                if (isVisa) {
                  setChooserOpen(true);
                  return;
                }
                setCommitOpen(true);
              }}
            >
              Kommit
            </BrutalButton>
            <BrutalButton
              size="xs"
              variant="outline"
              iconLeft={<Icon name="remove" size="xs" />}
              onClick={() => setWithdrawOpen(true)}
            >
              {isVisa ? "Withdraw to card" : "Withdraw"}
            </BrutalButton>
          </div>
        </div>
      </article>
      <CommitModal
        open={commitOpen}
        onOpenChange={setCommitOpen}
        project={project}
        onSuccess={onWithdrawSuccess}
      />
      <CommitChooserModal
        open={chooserOpen}
        onOpenChange={setChooserOpen}
        project={project}
        onChooseBalance={() => setCommitOpen(true)}
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
