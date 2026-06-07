"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { shortDate } from "@/lib/date-utils";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/common/Icon";
import { UpdateReactions, loadMine } from "@/components/project/UpdateReactions";
import { UpdateComments } from "@/components/project/UpdateComments";
import { useAuth } from "@/components/auth/AuthProvider";
import { getCommitmentForUserAndProject } from "@/lib/queries";
import { authedFetch } from "@/lib/api-client";
import {
  DEMO_POSITIONS_STORAGE_KEY,
  DEMO_ENGAGEMENT_SEEDED_KEY,
  seedFallbackUpdateId,
} from "@/lib/demo-engagement";
import { findSeedEngagement } from "@/lib/data/seed-engagement";
import type { RemoteUpdate } from "@/lib/api-types";
import type { ProjectUpdate } from "@/lib/data/projects";

/**
 * Handoff 82 — wave 5. Inline engagement surface for a dashboard commitment
 * row (audit P1-2 / Option A). This is the dashboard-scoped sibling of
 * `UpdatesPanel` on `/projects/[slug]`: it runs the same fetch + kommitter-
 * gate logic and composes the SAME engagement primitives (`UpdateReactions`,
 * `UpdateComments`) — no new reaction/comment code — but renders a compact,
 * height-bounded view: only the latest 2 updates, tighter cards, and a
 * "View all on project page" link for the full thread.
 *
 * Mounting is lazy: the parent row only renders this once expanded, so the
 * dashboard's first paint never fans out 6 simultaneous `/updates` fetches.
 *
 * Withdrawn-state (handoff 65 B2 / PR #61): a fully-withdrawn backer keeps a
 * truthy commitment row (`getCommitmentForUserAndProject` returns the position
 * with `kommittedUSD === 0`, `withdrawnAtMs` set), so the `!!c` gate below
 * still flips `isKommitter` true — they can read + react + comment on past
 * updates exactly like the project page allows.
 */

const MAX_INLINE_UPDATES = 2;

type MergedRow =
  | { kind: "remote"; atISO: string; data: RemoteUpdate }
  | { kind: "seed"; atISO: string; data: ProjectUpdate };

export function CommitmentEngagementPanel({
  projectPda,
  projectSlug,
  fallbackUpdates,
}: {
  /** Project PDA (base58) or null when the project has no on-chain account. */
  projectPda: string | null;
  projectSlug: string;
  /** Static catalog updates — source of truth for catalog projects and the
   *  fallback when the API returns empty/errors. */
  fallbackUpdates: ProjectUpdate[];
}) {
  const { user, isSignedIn } = useAuth();
  const [updates, setUpdates] = useState<RemoteUpdate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [isKommitter, setIsKommitter] = useState(false);
  // Re-fire the kommitter gate when demo positions change (simulateCommit /
  // simulateWithdraw write localStorage) so the gate flips without a reload —
  // mirrors UpdatesPanel's positionsTick.
  const [positionsTick, setPositionsTick] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === DEMO_POSITIONS_STORAGE_KEY || e.key === null) {
        setPositionsTick((t) => t + 1);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Resolve kommitter-of-this-project for the react/comment gate.
  useEffect(() => {
    if (!isSignedIn || !user?.wallet) {
      setIsKommitter(false);
      return;
    }
    let cancelled = false;
    getCommitmentForUserAndProject(user.wallet, projectSlug)
      .then((c) => {
        if (!cancelled) setIsKommitter(!!c);
      })
      .catch(() => {
        if (!cancelled) setIsKommitter(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, user?.wallet, projectSlug, positionsTick]);

  // Fetch the project's updates feed (same route the row already hits for the
  // unread "N new" count). Re-runs on seed-marker flips so demo-seeded pivot/
  // graduation updates land even if the panel mounts before the seed writes.
  useEffect(() => {
    if (!projectPda) {
      setUpdates([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    authedFetch(`/api/projects/${projectPda}/updates`, {
      mockWallet: user?.wallet ?? null,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: { updates: RemoteUpdate[] }) => {
        if (!cancelled) setUpdates(j.updates);
      })
      .catch(() => {
        if (!cancelled) setUpdates([]); // fall through to static fallback
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [projectPda, user?.wallet]);

  useEffect(() => {
    if (typeof window === "undefined" || !projectPda) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== DEMO_ENGAGEMENT_SEEDED_KEY) return;
      authedFetch(`/api/projects/${projectPda}/updates`, {
        mockWallet: user?.wallet ?? null,
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("refetch failed"))))
        .then((j: { updates: RemoteUpdate[] }) => setUpdates(j.updates))
        .catch(() => {
          /* non-fatal — initial fetch already populated state */
        });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [projectPda, user?.wallet]);

  const remoteRows = useMemo(() => updates ?? [], [updates]);

  // Merge static fallback + remote (remote wins on matching date), newest
  // first — same precedence as UpdatesPanel — then take only the latest few
  // for the compact inline view.
  const inlineRows = useMemo<MergedRow[]>(() => {
    const remoteByDate = new Map<string, RemoteUpdate>();
    for (const r of remoteRows) {
      const key = r.posted_at?.slice(0, 10) ?? "";
      if (key) remoteByDate.set(key, r);
    }
    const out: MergedRow[] = [];
    for (const s of fallbackUpdates) {
      const remote = remoteByDate.get(s.atISO);
      if (remote) {
        out.push({ kind: "remote", atISO: s.atISO, data: remote });
        remoteByDate.delete(s.atISO);
      } else {
        out.push({ kind: "seed", atISO: s.atISO, data: s });
      }
    }
    for (const [, r] of remoteByDate) {
      out.push({ kind: "remote", atISO: r.posted_at?.slice(0, 10) ?? "", data: r });
    }
    out.sort((a, b) => b.atISO.localeCompare(a.atISO));
    return out.slice(0, MAX_INLINE_UPDATES);
  }, [remoteRows, fallbackUpdates]);

  const disabledReason = !isSignedIn
    ? "Sign in and kommit to react."
    : isKommitter
      ? undefined
      : "Kommit to react.";

  const showLoading = loading && updates === null;

  return (
    <div className="space-y-4">
      {showLoading ? (
        <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest">
          Loading updates…
        </div>
      ) : null}

      {!showLoading && inlineRows.length === 0 ? (
        <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest">
          No updates yet — the founder hasn&rsquo;t posted.
        </div>
      ) : null}

      {inlineRows.map((row, i) =>
        row.kind === "remote" ? (
          <InlineRemoteUpdate
            key={row.data.id}
            update={row.data}
            projectSlug={projectSlug}
            isKommitter={isKommitter}
            disabledReason={disabledReason}
          />
        ) : (
          <InlineSeedUpdate
            key={`seed-${row.atISO}-${i}`}
            update={row.data}
            projectSlug={projectSlug}
            isKommitter={isKommitter}
            disabledReason={disabledReason}
          />
        ),
      )}

      <Link
        href={`/projects/${projectSlug}#updates`}
        className="inline-flex items-center gap-1.5 font-epilogue font-bold uppercase text-[11px] tracking-widest text-gray-600 hover:text-black"
      >
        View all on project page
        <Icon name="arrow_forward" size="xs" />
      </Link>
    </div>
  );
}

/** Compact card chrome shared by the remote + seed inline variants. */
function InlineUpdateShell({
  atISO,
  title,
  body,
  isPivot,
  isGraduation,
  children,
}: {
  atISO: string;
  title: string;
  body: string;
  isPivot?: boolean;
  isGraduation?: boolean;
  children: React.ReactNode;
}) {
  return (
    <article
      className={cn(
        "bg-white border-[2px] border-black p-4",
        isPivot ? "shadow-brutal-purple-sm" : "shadow-brutal-sm",
      )}
    >
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest">
          {shortDate(atISO)}
        </span>
        {isPivot ? (
          <span className="inline-block bg-primary text-white font-epilogue font-black uppercase text-[9px] tracking-widest px-1.5 py-0.5 border-[2px] border-black">
            Pivot
          </span>
        ) : null}
        {isGraduation ? (
          <span className="inline-block bg-secondary text-black font-epilogue font-black uppercase text-[9px] tracking-widest px-1.5 py-0.5 border-[2px] border-black">
            Graduation
          </span>
        ) : null}
      </div>
      <h4 className="font-epilogue font-black uppercase text-sm tracking-tight mb-1.5">
        {title}
      </h4>
      <p className="text-sm font-medium text-gray-800 leading-relaxed line-clamp-3 whitespace-pre-line">
        {body}
      </p>
      <div className="mt-3 pt-3 border-t-[2px] border-black">{children}</div>
    </article>
  );
}

function InlineRemoteUpdate({
  update,
  projectSlug,
  isKommitter,
  disabledReason,
}: {
  update: RemoteUpdate;
  projectSlug: string;
  isKommitter: boolean;
  disabledReason?: string;
}) {
  const initialMine =
    typeof window !== "undefined" ? loadMine(update.id) : new Set<never>();
  const atISO = update.posted_at?.slice(0, 10) ?? "";
  const staticHint = atISO ? { slug: projectSlug, atISO } : undefined;
  return (
    <InlineUpdateShell
      atISO={atISO}
      title={update.title}
      body={update.body}
      isPivot={update.is_pivot}
      isGraduation={update.is_graduation}
    >
      <UpdateReactions
        updateId={update.id}
        initialCounts={update.reactions ?? {}}
        initialMine={initialMine}
        canReact={isKommitter}
        disabledReason={disabledReason}
        staticHint={staticHint}
      />
      <UpdateComments
        updateId={update.id}
        canComment={isKommitter}
        disabledReason={disabledReason}
        staticHint={staticHint}
      />
    </InlineUpdateShell>
  );
}

function InlineSeedUpdate({
  update,
  projectSlug,
  isKommitter,
  disabledReason,
}: {
  update: ProjectUpdate;
  projectSlug: string;
  isKommitter: boolean;
  disabledReason?: string;
}) {
  // Stable (slug, atISO) id so reactions/comments persist + lazy-upsert the
  // same way the project page's SeedUpdateRow does.
  const fallbackId = useMemo(
    () => seedFallbackUpdateId(projectSlug, update.atISO),
    [projectSlug, update.atISO],
  );
  const seed = findSeedEngagement(projectSlug, update.atISO);
  const initialCounts = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    if (seed?.reactions) {
      for (const [k, v] of Object.entries(seed.reactions)) {
        if (typeof v === "number") out[k] = v;
      }
    }
    return out;
  }, [seed]);
  const initialMine =
    typeof window !== "undefined" ? loadMine(fallbackId) : new Set<never>();
  return (
    <InlineUpdateShell
      atISO={update.atISO}
      title={update.title}
      body={update.body}
      isPivot={update.isPivot}
      isGraduation={update.isGraduation}
    >
      <UpdateReactions
        updateId={fallbackId}
        initialCounts={initialCounts}
        initialMine={initialMine}
        canReact={isKommitter}
        disabledReason={disabledReason}
        staticHint={{ slug: projectSlug, atISO: update.atISO }}
      />
      <UpdateComments
        updateId={fallbackId}
        canComment={isKommitter}
        disabledReason={disabledReason}
        staticHint={{ slug: projectSlug, atISO: update.atISO }}
      />
    </InlineUpdateShell>
  );
}
