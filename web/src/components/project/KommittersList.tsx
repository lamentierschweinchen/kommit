"use client";

import { useEffect, useState } from "react";
import { relativeTime } from "@/lib/date-utils";
import { kommitsFor, formatNumber, formatUSD } from "@/lib/kommit-math";
import type { ProjectKommitter } from "@/lib/data/projects";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  DEMO_POSITIONS_STORAGE_KEY,
  getDemoPosition,
} from "@/lib/demo-engagement";
import { useDemoMode } from "@/lib/demo-mode";

export function KommittersList({
  kommitters,
  limit,
  projectSlug,
}: {
  kommitters: ProjectKommitter[];
  limit?: number;
  /** When provided, the list joins the seeded cohort with the current
   *  user's persona-mode position so a fresh kommit shows up immediately
   *  on the project page (handoff 58 #3). Without this prop the component
   *  renders the seeded list unchanged — preserves the pre-existing
   *  call-sites that don't have a slug context. */
  projectSlug?: string;
}) {
  const merged = useMergedWithCurrentUser(kommitters, projectSlug);
  const items = limit ? merged.slice(0, limit) : merged;

  if (items.length === 0) {
    return (
      <div className="bg-white border-[3px] border-black shadow-brutal p-6 text-center">
        <p className="font-epilogue font-black uppercase text-base tracking-tight">
          No kommitters yet. Be the first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((k, i) => (
        <KommitterRow key={`${k.name}-${i}`} kommitter={k} />
      ))}
    </div>
  );
}

/**
 * Merge the seeded cohort with the current persona's localStorage
 * position for `projectSlug`. Re-runs whenever a `simulateCommit` /
 * `simulateWithdraw` dispatches a synthetic storage event on the
 * positions key, so a kommit on this very page surfaces in the
 * "Recent kommitters" list within a tick.
 *
 * Real-Privy mode is unaffected: `useDemoMode` returns false and the
 * hook short-circuits before reading the demo store, leaving the
 * Anchor-driven view (already re-fetched by UserPositionCard) as the
 * single source of truth.
 */
function useMergedWithCurrentUser(
  seed: ProjectKommitter[],
  projectSlug: string | undefined,
): ProjectKommitter[] {
  const { user } = useAuth();
  const isDemo = useDemoMode();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === DEMO_POSITIONS_STORAGE_KEY || e.key === null) {
        setTick((t) => t + 1);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!isDemo || !projectSlug || !user?.wallet) return seed;
  // Suppress unused-var lint — `tick` exists only to invalidate the read.
  void tick;
  const pos = getDemoPosition(user.wallet, projectSlug);
  if (!pos || pos.kommittedUSD <= 0) return seed;

  const userIdMatch = (k: ProjectKommitter) =>
    !!user.id && k.userId === user.id;
  const nameMatch = (k: ProjectKommitter) =>
    k.name.toLowerCase() === user.displayName.toLowerCase();

  const existingIdx = seed.findIndex((k) => userIdMatch(k) || nameMatch(k));
  const updatedRow: ProjectKommitter = {
    name: user.displayName,
    avatarSeed: user.avatarSeed,
    userId: user.id,
    kommittedUSD: pos.kommittedUSD,
    sinceISO: pos.sinceISO,
  };
  if (existingIdx >= 0) {
    // Move the user's row to the top to reflect the freshness of the kommit.
    const next = [...seed];
    next.splice(existingIdx, 1);
    return [updatedRow, ...next];
  }
  return [updatedRow, ...seed];
}

function KommitterRow({ kommitter }: { kommitter: ProjectKommitter }) {
  const kommits = kommitsFor(kommitter.kommittedUSD, kommitter.sinceISO);
  return (
    <div className="bg-white border-[3px] border-black shadow-brutal p-4 flex items-center gap-4 flex-wrap font-epilogue font-bold tracking-tight">
      <span className="font-epilogue font-black text-sm tracking-tight bg-gray-100 px-2 py-1 border-[2px] border-black">
        {kommitter.name}
      </span>
      <span className="text-gray-500 uppercase text-xs tracking-widest">Committed</span>
      <span className="font-black">{formatUSD(kommitter.kommittedUSD)}</span>
      <span className="text-gray-500 uppercase text-xs tracking-widest">·</span>
      <span className="text-gray-500 uppercase text-xs tracking-widest">
        {relativeTime(kommitter.sinceISO)}
      </span>
      <span className="ml-auto bg-primary text-white px-2 py-1 border-[2px] border-black uppercase text-xs">
        {formatNumber(kommits)} kommits
      </span>
    </div>
  );
}
