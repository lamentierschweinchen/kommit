"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PublicKey } from "@solana/web3.js";
import { findProjectPda } from "@/lib/kommit";
import { getProject, type Project } from "@/lib/data/projects";
import type { Commitment } from "@/lib/data/commitments";
import type { RemoteUpdate } from "@/lib/api-types";
import { relativeTime } from "@/lib/date-utils";

type Activity = {
  update: RemoteUpdate;
  project: Project;
};

/**
 * P1.5 dashboard "Recent activity" widget. Pulls the latest updates from
 * every project the signed-in kommitter has a position in, merges them by
 * posted_at desc, and shows up to 5. Pull-based — no Realtime subscription
 * in v0.5 (P3.5).
 */
export function RecentActivityWidget({
  commitments,
  limit = 5,
}: {
  commitments: Commitment[];
  limit?: number;
}) {
  const projects = useMemo(() => {
    return commitments
      .map((c) => getProject(c.projectSlug))
      .filter((p): p is Project => !!p && !!p.recipientWallet);
  }, [commitments]);

  const [items, setItems] = useState<Activity[] | null>(null);

  useEffect(() => {
    if (projects.length === 0) {
      setItems([]);
      return;
    }
    let cancelled = false;
    Promise.all(
      projects.map(async (project) => {
        try {
          const pda = findProjectPda(new PublicKey(project.recipientWallet!)).toBase58();
          const r = await fetch(`/api/projects/${pda}/updates`);
          if (!r.ok) return [] as Activity[];
          const j = (await r.json()) as { updates: RemoteUpdate[] };
          return j.updates.slice(0, limit).map((u) => ({ update: u, project }));
        } catch {
          return [];
        }
      }),
    )
      .then((batches) => {
        if (cancelled) return;
        const merged = batches.flat();
        merged.sort((a, b) => b.update.posted_at.localeCompare(a.update.posted_at));
        setItems(merged.slice(0, limit));
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projects, limit]);

  if (items === null) {
    return (
      <div className="bg-white border-[3px] border-black shadow-brutal p-5">
        <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest">
          Loading activity…
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="bg-white border-[3px] border-black shadow-brutal p-5">
      <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest mb-3">
        Recent activity
      </div>
      <ul className="space-y-3">
        {items.map(({ update, project }) => (
          <li
            key={update.id}
            className="border-t-[2px] border-black pt-3 first:border-t-0 first:pt-0"
          >
            <div className="flex items-center gap-2 flex-wrap font-epilogue font-bold uppercase text-[10px] tracking-widest text-gray-500">
              <Link
                href={`/projects/${project.slug}#updates`}
                className="font-black text-black hover:underline"
              >
                {project.name}
              </Link>
              <span>·</span>
              <span>{relativeTime(update.posted_at.slice(0, 10))}</span>
              {update.is_pivot ? <span className="text-primary">· Pivot</span> : null}
            </div>
            <Link
              href={`/projects/${project.slug}#updates`}
              className="block mt-1 font-epilogue font-bold tracking-tight text-sm leading-snug hover:underline line-clamp-2"
            >
              {update.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
