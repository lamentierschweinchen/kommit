"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { relativeTime } from "@/lib/date-utils";
import type { ProjectUpdate } from "@/lib/data/projects";
import type { RemoteUpdate } from "@/lib/api-types";

type MiniRow = {
  key: string;
  atISO: string;
  title: string;
  isPivot?: boolean;
};

/**
 * Sticky-side mini-list of the 2-3 most recent updates for THIS project.
 * Fetches live data from /api/projects/[pda]/updates when a PDA is provided;
 * falls back to seeded `updates` so projects without an on-chain account
 * still render something.
 */
export function RecentUpdatesMini({
  projectSlug,
  projectPda,
  updates,
  limit = 3,
}: {
  projectSlug: string;
  projectPda?: string | null;
  updates: ProjectUpdate[];
  limit?: number;
}) {
  const [remote, setRemote] = useState<RemoteUpdate[] | null>(null);

  useEffect(() => {
    if (!projectPda) return;
    let cancelled = false;
    fetch(`/api/projects/${projectPda}/updates`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: { updates: RemoteUpdate[] }) => {
        if (!cancelled) setRemote(j.updates);
      })
      .catch(() => {
        if (!cancelled) setRemote(null);
      });
    return () => {
      cancelled = true;
    };
  }, [projectPda]);

  const rows: MiniRow[] =
    remote && remote.length > 0
      ? remote.slice(0, limit).map((u) => ({
          key: u.id,
          atISO: u.posted_at.slice(0, 10),
          title: u.title,
          isPivot: u.is_pivot,
        }))
      : updates.slice(0, limit).map((u, i) => ({
          key: `seed-${i}`,
          atISO: u.atISO,
          title: u.title,
          isPivot: u.isPivot,
        }));

  if (rows.length === 0) return null;

  return (
    <div className="bg-white border-[3px] border-black shadow-brutal p-5 mt-6">
      <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest mb-3">
        Recent updates
      </div>
      <ul className="space-y-3">
        {rows.map((u) => (
          <li
            key={u.key}
            className="border-t-[2px] border-black pt-3 first:border-t-0 first:pt-0"
          >
            <div className="font-epilogue font-bold uppercase text-[10px] tracking-widest text-gray-500">
              {relativeTime(u.atISO)}
              {u.isPivot ? <span className="text-primary ml-1.5">· Pivot</span> : null}
            </div>
            <Link
              href={`/projects/${projectSlug}#updates`}
              className="block mt-1 font-epilogue font-bold tracking-tight text-sm leading-snug hover:underline line-clamp-2"
            >
              {u.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
