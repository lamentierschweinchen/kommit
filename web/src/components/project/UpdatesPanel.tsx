"use client";

import { useEffect, useMemo, useState } from "react";
import { longDate } from "@/lib/date-utils";
import { cn } from "@/lib/cn";
import { UpdateReactions, loadMine } from "@/components/project/UpdateReactions";
import { UpdateComments } from "@/components/project/UpdateComments";
import { useAuth } from "@/components/auth/AuthProvider";
import { getCommitmentForUserAndProject } from "@/lib/queries";
import { authedFetch } from "@/lib/api-client";
import { DEMO_POSITIONS_STORAGE_KEY, seedFallbackUpdateId } from "@/lib/demo-engagement";
import { findSeedEngagement } from "@/lib/data/seed-engagement";
import type { RemoteUpdate } from "@/lib/api-types";

/**
 * Client-side updates panel for the project detail page. Fetches from
 * /api/projects/[pda]/updates on mount, renders update cards with reaction
 * row + comments toggle. Falls back to legacy seeded updates when the
 * project has no on-chain account or the request fails.
 */
export function UpdatesPanel({
  projectPda,
  projectSlug,
  isFounder,
  fallback,
}: {
  projectPda: string | null;
  projectSlug: string;
  isFounder?: boolean;
  /** Static-seed updates rendered when the API returns empty/errors so the
   *  page never goes blank for projects without on-chain history yet. */
  fallback: Array<{
    atISO: string;
    title: string;
    body: string;
    isPivot?: boolean;
    isGraduation?: boolean;
  }>;
}) {
  const { user, isSignedIn } = useAuth();
  const [updates, setUpdates] = useState<RemoteUpdate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [isKommitter, setIsKommitter] = useState(false);
  // Bumped on synthetic storage events from `simulateCommit` /
  // `simulateWithdraw`, forcing the kommitter-of-this-project effect
  // to re-fire so the comment + reaction gates flip the moment the
  // demo modal closes (handoff 58 #4). Without this the kommit lands
  // in localStorage but the gate stays "Kommit to comment" until reload.
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

  // Resolve kommitter-of-this-project state for the sybil gate UX.
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

  useEffect(() => {
    if (!projectPda) return;
    let cancelled = false;
    setLoading(true);
    authedFetch(`/api/projects/${projectPda}/updates`, { mockWallet: user?.wallet ?? null })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: { updates: RemoteUpdate[] }) => {
        if (!cancelled) setUpdates(j.updates);
      })
      .catch(() => {
        if (!cancelled) setUpdates([]); // fall through to fallback
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [projectPda, user?.wallet]);

  // P1.5: stamp lastSeen for this project on mount so the dashboard "N NEW"
  // pill resets after a kommitter visits the page.
  useEffect(() => {
    if (!projectPda || typeof window === "undefined") return;
    try {
      localStorage.setItem(`kommit:lastSeen:${projectPda}`, new Date().toISOString());
    } catch {
      /* non-fatal */
    }
  }, [projectPda]);

  const remoteRows = useMemo(() => updates ?? [], [updates]);

  // Merged render: ALL static updates render (so users can react/comment on
  // any of them, lazy-upsert wires them to Supabase on first interaction).
  // If a static date also exists in the remote feed, the remote row wins
  // (it has the real Supabase id and any indexer-side enrichment). Sort
  // newest-first by atISO. Handoff 70 fix #1: previously the panel would
  // render ONLY remote rows once any single static update got lazy-
  // upserted — silently hiding the rest of the static seed and making
  // reactions/comments "unreliable across projects."
  const merged = useMemo(() => {
    type RemoteRowItem = { kind: "remote"; atISO: string; data: typeof remoteRows[number] };
    type SeedRowItem = { kind: "seed"; atISO: string; data: typeof fallback[number] };
    type Row = RemoteRowItem | SeedRowItem;
    const remoteByDate = new Map<string, typeof remoteRows[number]>();
    for (const r of remoteRows) {
      const key = r.posted_at?.slice(0, 10) ?? "";
      if (key) remoteByDate.set(key, r);
    }
    const out: Row[] = [];
    // Start with static fallback (the source of truth for catalog projects).
    // Replace with remote row where dates match.
    for (const s of fallback) {
      const remote = remoteByDate.get(s.atISO);
      if (remote) {
        out.push({ kind: "remote", atISO: s.atISO, data: remote });
        remoteByDate.delete(s.atISO);
      } else {
        out.push({ kind: "seed", atISO: s.atISO, data: s });
      }
    }
    // Append remaining remote rows that don't correspond to any static
    // entry (founder-posted updates new since the catalog was last seeded).
    for (const [, r] of remoteByDate) {
      out.push({ kind: "remote", atISO: r.posted_at?.slice(0, 10) ?? "", data: r });
    }
    out.sort((a, b) => b.atISO.localeCompare(a.atISO));
    return out;
  }, [remoteRows, fallback]);

  const disabledReason = !isSignedIn
    ? "Sign in and kommit to react."
    : isKommitter
      ? undefined
      : "Kommit to react.";

  return (
    <div className="space-y-5">
      {loading && !updates ? (
        <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest">
          Loading updates…
        </div>
      ) : null}

      {merged.map((row, i) =>
        row.kind === "remote" ? (
          <RemoteUpdateRow
            key={row.data.id}
            update={row.data}
            projectSlug={projectSlug}
            isKommitter={isKommitter}
            isFounder={isFounder}
            disabledReason={disabledReason}
          />
        ) : (
          <SeedUpdateRow
            key={`seed-${row.atISO}-${i}`}
            update={row.data}
            projectSlug={projectSlug}
            isKommitter={isKommitter}
            isFounder={isFounder}
            disabledReason={disabledReason}
          />
        ),
      )}

      {!loading && merged.length === 0 ? (
        <div className="bg-white border-[3px] border-black shadow-brutal p-6">
          <p className="font-epilogue font-bold uppercase text-sm tracking-tight">
            No updates yet.
          </p>
          <p className="mt-2 text-sm font-medium text-gray-700">
            The founder hasn&rsquo;t posted yet. Updates land here as soon as they do.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function RemoteUpdateRow({
  update,
  projectSlug,
  isKommitter,
  isFounder,
  disabledReason,
}: {
  update: RemoteUpdate;
  /** Project slug — used to pass staticHint to children for defensive
   *  lazy-upsert if a remote row's id was orphaned by an older id
   *  derivation (handoff 70 fix #1). */
  projectSlug: string;
  isKommitter: boolean;
  isFounder?: boolean;
  disabledReason?: string;
}) {
  const initialMine = typeof window !== "undefined" ? loadMine(update.id) : new Set<never>();
  const atISO = update.posted_at?.slice(0, 10) ?? "";
  const staticHint = atISO ? { slug: projectSlug, atISO } : undefined;
  return (
    <article
      className={cn(
        "bg-white border-[3px] border-black p-6",
        update.is_pivot ? "shadow-brutal-purple" : "shadow-brutal",
      )}
    >
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <span className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest">
          {longDate(update.posted_at.slice(0, 10))}
        </span>
        {update.is_pivot ? (
          <span className="inline-block bg-primary text-white font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black shadow-brutal-sm">
            Pivot
          </span>
        ) : null}
        {update.is_graduation ? (
          <span className="inline-block bg-secondary text-black font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black shadow-brutal-sm">
            Graduation
          </span>
        ) : null}
      </div>
      <h3 className="font-epilogue font-black uppercase text-lg md:text-xl tracking-tight mb-2">
        {update.title}
      </h3>
      <p className="text-base font-medium text-gray-800 leading-relaxed whitespace-pre-line">
        {update.body}
      </p>

      <div className="mt-5 pt-4 border-t-[2px] border-black">
        <UpdateReactions
          updateId={update.id}
          initialCounts={update.reactions ?? {}}
          initialMine={initialMine}
          canReact={isKommitter}
          disabledReason={disabledReason}
          staticHint={staticHint}
        />
      </div>

      <UpdateComments
        updateId={update.id}
        isFounder={isFounder}
        canComment={isKommitter}
        disabledReason={disabledReason}
        staticHint={staticHint}
      />
    </article>
  );
}

function SeedUpdateRow({
  update,
  projectSlug,
  isKommitter,
  isFounder,
  disabledReason,
}: {
  update: { atISO: string; title: string; body: string; isPivot?: boolean; isGraduation?: boolean };
  projectSlug: string;
  isKommitter: boolean;
  isFounder?: boolean;
  disabledReason?: string;
}) {
  // Derive a stable id from (slug, atISO) so reactions + comments persist
  // across reloads on the fallback render path. Handoff 70 fix #1: the
  // previous (slug, atISO, idx) derivation gave the same dated update a
  // different id whenever the order of `project.updates` shifted — past
  // interactions got orphaned and lazy-upsert kept re-inserting rows for
  // "the same" update. (slug, atISO) is unique per static update by
  // construction.
  const fallbackId = useMemo(
    () => seedFallbackUpdateId(projectSlug, update.atISO),
    [projectSlug, update.atISO],
  );
  // Pivot/graduation seeds carry pre-populated reaction counts. Resolve via
  // the same (slug, atISO) key the demo-cohort seed loop uses so the SSR
  // render of the fallback path already shows the seed counts; demo-mode
  // additions stack on top once the API store hydrates.
  const seed = findSeedEngagement(projectSlug, update.atISO);
  const initialCounts: Record<string, number> = useMemo(() => {
    const out: Record<string, number> = {};
    if (seed?.reactions) {
      for (const [k, v] of Object.entries(seed.reactions)) {
        if (typeof v === "number") out[k] = v;
      }
    }
    return out;
  }, [seed]);
  const initialMine = typeof window !== "undefined" ? loadMine(fallbackId) : new Set<never>();
  return (
    <article
      className={cn(
        "bg-white border-[3px] border-black p-6",
        update.isPivot ? "shadow-brutal-purple" : "shadow-brutal",
      )}
    >
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <span className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest">
          {longDate(update.atISO)}
        </span>
        {update.isPivot ? (
          <span className="inline-block bg-primary text-white font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black shadow-brutal-sm">
            Pivot
          </span>
        ) : null}
        {update.isGraduation ? (
          <span className="inline-block bg-secondary text-black font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black shadow-brutal-sm">
            Graduation
          </span>
        ) : null}
      </div>
      <h3 className="font-epilogue font-black uppercase text-lg md:text-xl tracking-tight mb-2">
        {update.title}
      </h3>
      <p className="text-base font-medium text-gray-800 leading-relaxed whitespace-pre-line">
        {update.body}
      </p>

      <div className="mt-5 pt-4 border-t-[2px] border-black">
        <UpdateReactions
          updateId={fallbackId}
          initialCounts={initialCounts}
          initialMine={initialMine}
          canReact={isKommitter}
          disabledReason={disabledReason}
          staticHint={{ slug: projectSlug, atISO: update.atISO }}
        />
      </div>

      <UpdateComments
        updateId={fallbackId}
        isFounder={isFounder}
        canComment={isKommitter}
        disabledReason={disabledReason}
        staticHint={{ slug: projectSlug, atISO: update.atISO }}
      />
    </article>
  );
}

