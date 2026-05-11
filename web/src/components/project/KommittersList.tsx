"use client";

import { useEffect, useState } from "react";
import { relativeTime } from "@/lib/date-utils";
import { kommitsFor, formatNumber, formatUSD } from "@/lib/kommit-math";
import type { ProjectKommitter } from "@/lib/data/projects";
import { useAuth } from "@/components/auth/AuthProvider";
import { DEMO_POSITIONS_STORAGE_KEY } from "@/lib/demo-engagement";
import { getCommitmentForUserAndProject } from "@/lib/queries";

/** Window event dispatched by CommitModal / WithdrawModal after a successful
 *  on-chain or simulated transaction. Sibling client islands (this list, etc.)
 *  listen and refetch — sidesteps lifting state into the RSC page. */
export const KOMMIT_TX_EVENT = "kommit:tx";

export function KommittersList({
  kommitters,
  limit,
  projectSlug,
}: {
  kommitters: ProjectKommitter[];
  limit?: number;
  /** When provided, the list joins the seeded cohort with the current
   *  user's live position (demo or real-Privy) so a fresh kommit shows up
   *  immediately on the project page. Without this prop the component
   *  renders the seeded list unchanged — preserves the pre-existing
   *  call-sites that don't have a slug context. */
  projectSlug?: string;
}) {
  const { currentUserKey, merged } = useMergedWithCurrentUser(
    kommitters,
    projectSlug,
  );
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
      {items.map((k, i) => {
        const isYou =
          currentUserKey !== null && rowKey(k) === currentUserKey;
        return (
          <KommitterRow
            key={`${k.name}-${i}`}
            kommitter={k}
            isCurrentUser={isYou}
          />
        );
      })}
    </div>
  );
}

function rowKey(k: ProjectKommitter): string {
  return k.userId ? `id:${k.userId}` : `name:${k.name.toLowerCase()}`;
}

/**
 * Merge the seeded cohort with the current user's live position for
 * `projectSlug`. Live position is sourced from `getCommitmentForUserAndProject`
 * which handles both demo (localStorage) and real-Privy (on-chain) modes
 * uniformly.
 *
 * Re-fetches whenever:
 * - the storage event fires (demo simulateCommit/Withdraw dispatch one)
 * - the custom `kommit:tx` window event fires (real-Privy success path)
 * - user / wallet / slug changes
 */
function useMergedWithCurrentUser(
  seed: ProjectKommitter[],
  projectSlug: string | undefined,
): { currentUserKey: string | null; merged: ProjectKommitter[] } {
  const { user } = useAuth();
  const [live, setLive] = useState<{
    kommittedUSD: number;
    sinceISO: string;
  } | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const bump = () => setTick((t) => t + 1);
    const onStorage = (e: StorageEvent) => {
      if (e.key === DEMO_POSITIONS_STORAGE_KEY || e.key === null) bump();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(KOMMIT_TX_EVENT, bump);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(KOMMIT_TX_EVENT, bump);
    };
  }, []);

  useEffect(() => {
    if (!projectSlug || !user?.wallet) {
      setLive(null);
      return;
    }
    let cancelled = false;
    getCommitmentForUserAndProject(user.wallet, projectSlug)
      .then((c) => {
        if (cancelled) return;
        if (c && c.kommittedUSD > 0) {
          setLive({ kommittedUSD: c.kommittedUSD, sinceISO: c.sinceISO });
        } else {
          setLive(null);
        }
      })
      .catch(() => {
        if (!cancelled) setLive(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.wallet, projectSlug, tick]);

  if (!user || !live) {
    return { currentUserKey: null, merged: seed };
  }

  const userIdMatch = (k: ProjectKommitter) =>
    !!user.id && k.userId === user.id;
  const nameMatch = (k: ProjectKommitter) =>
    k.name.toLowerCase() === user.displayName.toLowerCase();

  const existingIdx = seed.findIndex((k) => userIdMatch(k) || nameMatch(k));
  const merged: ProjectKommitter[] = [...seed];
  const updatedRow: ProjectKommitter = {
    name: user.displayName,
    avatarSeed: user.avatarSeed,
    userId: user.id,
    kommittedUSD: live.kommittedUSD,
    sinceISO: live.sinceISO,
  };
  if (existingIdx >= 0) {
    merged.splice(existingIdx, 1);
  }
  merged.unshift(updatedRow);
  return { currentUserKey: rowKey(updatedRow), merged };
}

function KommitterRow({
  kommitter,
  isCurrentUser,
}: {
  kommitter: ProjectKommitter;
  isCurrentUser: boolean;
}) {
  const kommits = kommitsFor(kommitter.kommittedUSD, kommitter.sinceISO);
  return (
    <div className="bg-white border-[3px] border-black shadow-brutal p-4 flex items-center gap-4 flex-wrap font-epilogue font-bold tracking-tight">
      <span className="font-epilogue font-black text-sm tracking-tight bg-gray-100 px-2 py-1 border-[2px] border-black">
        {kommitter.name}
      </span>
      {isCurrentUser ? (
        <span className="bg-primary text-white px-2 py-1 border-[2px] border-black font-epilogue font-black uppercase text-[10px] tracking-widest shadow-brutal-sm">
          You
        </span>
      ) : null}
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
