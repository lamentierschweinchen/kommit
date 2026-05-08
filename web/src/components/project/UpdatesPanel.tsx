"use client";

import { useEffect, useMemo, useState } from "react";
import { longDate } from "@/lib/date-utils";
import { cn } from "@/lib/cn";
import { UpdateReactions, loadMine } from "@/components/project/UpdateReactions";
import { UpdateComments } from "@/components/project/UpdateComments";
import { useAuth } from "@/components/auth/AuthProvider";
import { getCommitmentForUserAndProject } from "@/lib/queries";
import { authedFetch } from "@/lib/api-client";
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
  }, [isSignedIn, user?.wallet, projectSlug]);

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
  const showRemote = remoteRows.length > 0;
  const showFallback = !showRemote && fallback.length > 0;

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

      {showRemote
        ? remoteRows.map((u) => (
            <RemoteUpdateRow
              key={u.id}
              update={u}
              isKommitter={isKommitter}
              isFounder={isFounder}
              disabledReason={disabledReason}
            />
          ))
        : null}

      {showFallback
        ? fallback.map((u, i) => <SeedUpdateRow key={`seed-${i}`} update={u} />)
        : null}

      {!loading && !showRemote && !showFallback ? (
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
  isKommitter,
  isFounder,
  disabledReason,
}: {
  update: RemoteUpdate;
  isKommitter: boolean;
  isFounder?: boolean;
  disabledReason?: string;
}) {
  const initialMine = typeof window !== "undefined" ? loadMine(update.id) : new Set<never>();
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
        />
      </div>

      <UpdateComments
        updateId={update.id}
        isFounder={isFounder}
        canComment={isKommitter}
        disabledReason={disabledReason}
      />
    </article>
  );
}

function SeedUpdateRow({
  update,
}: {
  update: { atISO: string; title: string; body: string; isPivot?: boolean; isGraduation?: boolean };
}) {
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
    </article>
  );
}
