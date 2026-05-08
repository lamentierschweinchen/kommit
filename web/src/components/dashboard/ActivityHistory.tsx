"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDemoMode } from "@/lib/demo-mode";
import {
  getDemoActivity,
  type DemoActivityEntry,
} from "@/lib/demo-engagement";
import { getProject } from "@/lib/data/projects";
import { formatUSD } from "@/lib/kommit-math";
import { relativeTime } from "@/lib/date-utils";
import { Icon, type IconName } from "@/components/common/Icon";
import { cn } from "@/lib/cn";

/**
 * Transaction history for the kommitter dashboard. Reads from the demo
 * activity log (currently demo-mode only — when on-chain reads land for
 * real-mode this swaps to a tx-history endpoint).
 */
export function ActivityHistory({ wallet }: { wallet: string }) {
  const isDemo = useDemoMode();
  const [entries, setEntries] = useState<DemoActivityEntry[]>([]);

  useEffect(() => {
    if (!isDemo || !wallet) {
      setEntries([]);
      return;
    }
    setEntries(getDemoActivity(wallet, 25));
    // Re-read on storage changes so a kommit fired in another tab shows up.
    const onStorage = () => setEntries(getDemoActivity(wallet, 25));
    if (typeof window !== "undefined") {
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    }
  }, [isDemo, wallet]);

  if (!isDemo) return null;

  if (entries.length === 0) {
    return (
      <div className="bg-white border-[3px] border-black shadow-brutal p-6">
        <p className="font-epilogue font-bold uppercase text-sm tracking-tight">
          No activity yet.
        </p>
        <p className="mt-2 text-sm font-medium text-gray-700">
          Your kommits, withdrawals, and reactions land here as you act.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {entries.map((e, i) => (
        <ActivityRow key={`${e.atISO}-${i}`} entry={e} />
      ))}
    </ul>
  );
}

const KIND_META: Record<DemoActivityEntry["kind"], { icon: IconName; label: string; color: string }> = {
  commit: { icon: "add", label: "Kommitted", color: "bg-primary text-white" },
  withdraw: { icon: "remove", label: "Withdrew", color: "bg-white text-black" },
  "post-update": { icon: "edit_note", label: "Posted update", color: "bg-secondary text-black" },
  react: { icon: "workspace_premium", label: "Reacted", color: "bg-white text-black" },
  comment: { icon: "edit_note", label: "Commented", color: "bg-white text-black" },
};

function ActivityRow({ entry }: { entry: DemoActivityEntry }) {
  const meta = KIND_META[entry.kind];
  const project = entry.projectSlug ? getProject(entry.projectSlug) : null;
  return (
    <li className="bg-white border-[3px] border-black p-4 flex items-center gap-4">
      <span
        className={cn(
          "shrink-0 w-9 h-9 border-[2px] border-black flex items-center justify-center",
          meta.color,
        )}
      >
        <Icon name={meta.icon} size="sm" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-epilogue font-bold uppercase text-xs tracking-tight">
          {meta.label}
          {entry.amountUSD ? (
            <>
              {" "}
              <span className="font-black">{formatUSD(entry.amountUSD)}</span>
            </>
          ) : null}
          {project ? (
            <>
              {" "}
              {entry.kind === "withdraw" ? "from" : "to"}{" "}
              <Link
                href={`/projects/${project.slug}`}
                className="font-black underline decoration-2 underline-offset-2 hover:bg-secondary"
              >
                {project.name}
              </Link>
            </>
          ) : entry.label ? (
            <span className="font-medium normal-case tracking-normal">
              {" "}
              · {entry.label}
            </span>
          ) : null}
        </div>
        <div className="font-epilogue font-medium text-[10px] uppercase tracking-widest text-gray-500">
          {relativeTime(entry.atISO.slice(0, 10))}
        </div>
      </div>
    </li>
  );
}
