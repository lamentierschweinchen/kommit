"use client";

import { useEffect, useState } from "react";
import { formatUSD } from "@/lib/kommit-math";
import { relativeTime } from "@/lib/date-utils";
import {
  DEMO_BACKER_NOTES_STORAGE_KEY,
  listBackerNotes,
  type BackerNote,
} from "@/lib/demo-engagement";

/**
 * Public "Backer notes" panel on the project detail page. Renders any notes
 * that backers attached to their kommits. v0.5 reads from localStorage —
 * v1 rewires to a server-backed comments store. Hidden when there are no
 * notes so the page doesn't grow an empty panel for fresh projects.
 */
export function BackerNotes({ projectSlug }: { projectSlug: string }) {
  const [notes, setNotes] = useState<BackerNote[]>([]);

  useEffect(() => {
    const refresh = () => setNotes(listBackerNotes(projectSlug));
    refresh();
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === DEMO_BACKER_NOTES_STORAGE_KEY || e.key === null) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [projectSlug]);

  if (notes.length === 0) return null;

  return (
    <section>
      <h2 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit mb-8">
        Kommit notes
      </h2>
      <ul className="space-y-3">
        {notes.map((n, i) => (
          <li
            key={`${n.atISO}-${i}`}
            className="bg-white border-[3px] border-black shadow-brutal p-5"
          >
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="font-epilogue font-black uppercase text-sm tracking-tight">
                {n.authorName}
              </span>
              <span className="font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest">
                kommitted {formatUSD(n.principalUSD)}
              </span>
              <span className="font-epilogue font-bold uppercase text-[10px] text-gray-400 tracking-widest">
                · {relativeTime(n.atISO.slice(0, 10))}
              </span>
            </div>
            <p className="text-base font-medium text-gray-800 leading-relaxed">
              &ldquo;{n.note}&rdquo;
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
