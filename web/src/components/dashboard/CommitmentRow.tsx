"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PublicKey } from "@solana/web3.js";
import { CommitModal } from "@/components/commit/CommitModal";
import { WithdrawModal } from "@/components/commit/WithdrawModal";
import { ClaimBenefitsModal } from "@/components/dashboard/ClaimBenefitsModal";
import { CommitmentEngagementPanel } from "@/components/dashboard/CommitmentEngagementPanel";
import { BrutalButton } from "@/components/common/BrutalButton";
import { kommitsFor, formatNumber, formatUSD } from "@/lib/kommit-math";
import { shortDate } from "@/lib/date-utils";
import { projectImageUrl, type Project } from "@/lib/data/projects";
import { useLiveKommits, formatLiveKommits } from "@/lib/hooks/useLiveKommits";
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
  expanded = false,
  onToggleExpand,
}: {
  commitment: Commitment;
  project: Project;
  /** Fires after a successful withdraw OR top-up so callers can refresh. */
  onWithdrawSuccess?: () => void;
  /** Handoff 82 wave 5: controlled inline-engagement expansion. The parent
   *  owns the open row (one-open-at-a-time accordion) so opening a second row
   *  collapses the first — keeps a 375px viewport from filling with stacked
   *  expanded panels. */
  expanded?: boolean;
  onToggleExpand?: () => void;
}) {
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [commitOpen, setCommitOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [updateCount, setUpdateCount] = useState<number | null>(null);
  const [projectPda, setProjectPda] = useState<string | null>(null);
  const isPivot = !!commitment.pivotedAtISO;
  const isGraduated = project.state === "graduated";
  // Handoff 65 B2: a full withdraw zeroes principal but keeps the row with
  // `withdrawnAtMs` set + a frozen kommit snapshot. The row reads as
  // "WITHDRAWN" with the kommit count locked.
  const isWithdrawn =
    !!commitment.withdrawnAtMs && commitment.kommittedUSD <= 0;

  useEffect(() => {
    if (!project.recipientWallet || typeof window === "undefined") return;
    let cancelled = false;
    let pda: string;
    try {
      pda = findProjectPda(new PublicKey(project.recipientWallet)).toBase58();
    } catch {
      return;
    }
    setProjectPda(pda);
    const lastSeen = localStorage.getItem(`kommit:lastSeen:${pda}`);
    authedFetch(`/api/projects/${pda}/updates`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("fetch failed"))))
      .then((j: { updates: RemoteUpdate[] }) => {
        if (cancelled) return;
        // Total updates count for the "Updates (N)" affordance. Merge remote
        // dates with the static catalog fallback (the engagement panel renders
        // the same union) so the badge count matches what expanding reveals.
        const dates = new Set<string>(project.updates.map((u) => u.atISO));
        for (const u of j.updates) {
          const d = u.posted_at?.slice(0, 10);
          if (d) dates.add(d);
        }
        setUpdateCount(dates.size);
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
        if (cancelled) return;
        setNewCount(0);
        // API unreachable — still surface the static catalog count so the
        // engagement affordance works offline / pre-indexer.
        setUpdateCount(project.updates.length);
      });
    return () => {
      cancelled = true;
    };
  }, [project.recipientWallet, project.updates]);
  // Accrual freezes at the earliest of (now, graduation, withdrawal).
  // Handoff 65 B2: "kommits should stop accumulating when graduation date is
  // reached, AND the kommits should still be visible — they're soulbound."
  const graduatedAtMs = project.graduatedAtISO
    ? new Date(`${project.graduatedAtISO}T00:00:00Z`).getTime()
    : undefined;
  const freezeAtMs =
    graduatedAtMs != null && commitment.withdrawnAtMs != null
      ? Math.min(graduatedAtMs, commitment.withdrawnAtMs)
      : graduatedAtMs ?? commitment.withdrawnAtMs;
  const liveKommits = useLiveKommits(
    commitment.kommittedUSD,
    commitment.sinceISO,
    commitment.sinceMs,
    freezeAtMs,
    commitment.frozenKommits,
  );
  const kommitsDisplay =
    liveKommits > 0
      ? formatLiveKommits(liveKommits)
      : formatNumber(kommitsFor(commitment.kommittedUSD, commitment.sinceISO));
  const moneyLabel = formatUSD(commitment.kommittedUSD);
  const founder = project.founders[0];

  return (
    <>
      <article
        className={cn(
          "bg-white border-[3px] border-black p-5 relative",
          isGraduated || isPivot ? "shadow-brutal-purple mt-3" : "shadow-brutal",
          isWithdrawn && "bg-gray-50 opacity-95",
        )}
      >
        {/* Pass-3 layout fix (Option A): two-zone single-row.
            Image (shrink-0) | info zone (flex-1 min-w-0, name/pitch/meta) |
            right zone (shrink-0, stat above actions, items-end).
            Stacks vertically at narrow widths. Wave 5 lifts this into an inner
            div so the inline engagement panel can sit full-width below it. */}
        <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
        {isGraduated ? (
          <div className="absolute -top-3 left-6 z-10">
            <span className="inline-block bg-primary text-white font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black shadow-brutal-sm">
              ★ Graduated{project.graduatedAtISO ? ` ${shortDate(project.graduatedAtISO)}` : ""}
            </span>
          </div>
        ) : isPivot ? (
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
              {/* Handoff 69 B8: kommits is the score; dollars only matter for
                  positions where principal is still at-stake. Graduated /
                  withdrawn → drop the dollar subline so the kommits number
                  reads as the headline metric. */}
              {isWithdrawn
                ? "kommits · frozen · soulbound"
                : isGraduated
                  ? "kommits · graduated"
                  : `kommits · ${moneyLabel} currently kommitted`}
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2 md:justify-end">
            {newCount > 0 ? (
              <span className="inline-block bg-primary text-white font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black shadow-brutal-sm">
                {newCount} new
              </span>
            ) : null}
            {/* Handoff 82 wave 5: the third action — inline engagement. Expands
                the row into the founder-updates + reactions + comments loop
                (audit P1-2 / Option A) so the dashboard is the engagement
                surface, not a list of links to /projects/[slug]. */}
            <BrutalButton
              size="xs"
              variant={expanded ? "primary" : "outline"}
              aria-expanded={expanded}
              aria-controls={`engagement-${commitment.projectSlug}`}
              iconLeft={<Icon name="groups" size="xs" />}
              iconRight={
                <Icon
                  name="expand_more"
                  size="xs"
                  className={cn("transition-transform", expanded && "rotate-180")}
                />
              }
              onClick={() => onToggleExpand?.()}
            >
              {updateCount != null ? `Updates (${updateCount})` : "Updates"}
            </BrutalButton>
            {isWithdrawn ? (
              <>
                <span className="inline-block bg-black text-white font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black shadow-brutal-sm">
                  Withdrawn
                </span>
                {!isGraduated ? (
                  <BrutalButton
                    size="xs"
                    variant="primary"
                    iconLeft={<Icon name="add" size="xs" />}
                    onClick={() => setCommitOpen(true)}
                  >
                    Rekommit
                  </BrutalButton>
                ) : null}
              </>
            ) : isGraduated ? (
              <>
                <BrutalButton
                  size="xs"
                  variant="primary"
                  iconLeft={<Icon name="workspace_premium" size="xs" />}
                  onClick={() => setClaimOpen(true)}
                >
                  Claim benefits
                </BrutalButton>
                <BrutalButton
                  size="xs"
                  variant="outline"
                  iconLeft={<Icon name="remove" size="xs" />}
                  onClick={() => setWithdrawOpen(true)}
                >
                  Withdraw
                </BrutalButton>
              </>
            ) : (
              <>
                <BrutalButton
                  size="xs"
                  variant="primary"
                  iconLeft={<Icon name="add" size="xs" />}
                  onClick={() => setCommitOpen(true)}
                >
                  Kommit
                </BrutalButton>
                <BrutalButton
                  size="xs"
                  variant="outline"
                  iconLeft={<Icon name="remove" size="xs" />}
                  onClick={() => setWithdrawOpen(true)}
                >
                  Withdraw
                </BrutalButton>
              </>
            )}
          </div>
        </div>
        </div>

        {/* Inline engagement (wave 5). Grid-rows height transition keeps the
            expand/collapse smooth without framer-motion (not a dep here) and
            without the layout thrash of animating `height: auto`. The panel
            only mounts while open, so collapsed rows never fetch updates and
            the dashboard's first paint stays cheap. */}
        <div
          id={`engagement-${commitment.projectSlug}`}
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-out",
            expanded ? "grid-rows-[1fr] mt-5" : "grid-rows-[0fr]",
          )}
        >
          <div className="overflow-hidden min-h-0">
            <div className="border-t-[2px] border-black pt-5">
              {expanded ? (
                <CommitmentEngagementPanel
                  projectPda={projectPda}
                  projectSlug={project.slug}
                  fallbackUpdates={project.updates}
                />
              ) : null}
            </div>
          </div>
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
        sinceISO={commitment.sinceISO}
        sinceMs={commitment.sinceMs}
        frozenKommits={commitment.frozenKommits}
        onSuccess={onWithdrawSuccess}
      />
      <ClaimBenefitsModal
        open={claimOpen}
        onOpenChange={setClaimOpen}
        project={project}
      />
    </>
  );
}
