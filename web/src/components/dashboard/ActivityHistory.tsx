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
import { PaginatedList } from "@/components/common/PaginatedList";
import { cn } from "@/lib/cn";

/**
 * Transaction history for the kommitter dashboard. Reads from the demo
 * activity log (currently demo-mode only — when on-chain reads land for
 * real-mode this swaps to a tx-history endpoint).
 *
 * `kinds` filters the activity-feed types — pass e.g. `["commit", "withdraw"]`
 * for a "My history" view that hides reactions/comments. Defaults to all.
 *
 * `compact` renders a sidebar-friendly layout — narrower rows, no shadows,
 * truncated project names. Used by the sidebar's "My history" surface.
 */
export function ActivityHistory({
  wallet,
  kinds,
  defaultLimit,
  compact = false,
  emptyHeadline = "No activity yet.",
  emptyBody = "Your kommits, withdrawals, and reactions land here as you act.",
}: {
  wallet: string;
  kinds?: DemoActivityEntry["kind"][];
  defaultLimit?: number;
  compact?: boolean;
  emptyHeadline?: string;
  emptyBody?: string;
}) {
  const isDemo = useDemoMode();
  const [entries, setEntries] = useState<DemoActivityEntry[]>([]);

  useEffect(() => {
    if (!isDemo || !wallet) {
      setEntries([]);
      return;
    }
    setEntries(getDemoActivity(wallet, 200));
    const onStorage = () => setEntries(getDemoActivity(wallet, 200));
    if (typeof window !== "undefined") {
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    }
  }, [isDemo, wallet]);

  if (!isDemo) return null;

  const filtered = kinds ? entries.filter((e) => kinds.includes(e.kind)) : entries;

  if (filtered.length === 0) {
    return (
      <div className={cn(
        "bg-white border-[3px] border-black",
        compact ? "p-3" : "shadow-brutal p-6",
      )}>
        <p className={cn(
          "font-epilogue font-bold uppercase tracking-tight",
          compact ? "text-xs" : "text-sm",
        )}>
          {emptyHeadline}
        </p>
        {compact ? null : (
          <p className="mt-2 text-sm font-medium text-gray-700">{emptyBody}</p>
        )}
      </div>
    );
  }

  if (defaultLimit && filtered.length > defaultLimit) {
    return (
      <PaginatedList
        items={filtered}
        defaultLimit={defaultLimit}
        itemKey={(e, i) => `${e.atISO}-${i}`}
        renderItem={(e) => <ActivityRow entry={e} compact={compact} />}
      />
    );
  }

  return (
    <ul className={compact ? "space-y-1.5" : "space-y-2"}>
      {filtered.map((e, i) => (
        <li key={`${e.atISO}-${i}`}>
          <ActivityRow entry={e} compact={compact} />
        </li>
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

function ActivityRow({ entry, compact = false }: { entry: DemoActivityEntry; compact?: boolean }) {
  const meta = KIND_META[entry.kind];
  const project = entry.projectSlug ? getProject(entry.projectSlug) : null;
  return (
    <div className={cn(
      "bg-white border-[3px] border-black flex items-center",
      compact ? "p-2 gap-2.5" : "p-4 gap-4",
    )}>
      <span
        className={cn(
          "shrink-0 border-[2px] border-black flex items-center justify-center",
          compact ? "w-6 h-6" : "w-9 h-9",
          meta.color,
        )}
      >
        <Icon name={meta.icon} size={compact ? "xs" : "sm"} />
      </span>
      <div className="flex-1 min-w-0">
        <div className={cn(
          "font-epilogue font-bold uppercase tracking-tight truncate",
          compact ? "text-[10px]" : "text-xs",
        )}>
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
        <div className={cn(
          "font-epilogue font-medium uppercase tracking-widest text-gray-500",
          compact ? "text-[9px]" : "text-[10px]",
        )}>
          {relativeTime(entry.atISO.slice(0, 10))}
        </div>
      </div>
    </div>
  );
}
