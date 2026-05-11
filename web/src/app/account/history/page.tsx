"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthHeader } from "@/components/layout/AuthHeader";
import { Footer } from "@/components/layout/Footer";
import { Sidebar } from "@/components/layout/Sidebar";
import { useAuth } from "@/components/auth/AuthProvider";
import { AuthGate } from "@/components/auth/AuthGate";
import { Icon, type IconName } from "@/components/common/Icon";
import { PaginatedList } from "@/components/common/PaginatedList";
import { getCommitmentsForUser } from "@/lib/queries";
import { getProject } from "@/lib/data/projects";
import type { Commitment } from "@/lib/data/commitments";
import { formatNumber, formatUSD } from "@/lib/kommit-math";
import {
  useLiveKommits,
  useLiveKommitsTotal,
  formatLiveKommits,
} from "@/lib/hooks/useLiveKommits";
import { useDemoMode } from "@/lib/demo-mode";
import {
  getDemoActivity,
  type DemoActivityEntry,
} from "@/lib/demo-engagement";
import { relativeTime, parseISODate } from "@/lib/date-utils";
import { cn } from "@/lib/cn";

/**
 * Money-moving entry rendered in the history list. Unifies the demo
 * activity log with the real-Privy `Commitment` reads so the page works
 * for both flows. Reactions/comments are excluded — this surface is the
 * dollar trail, not the engagement feed.
 */
type HistoryEntry = {
  kind: "commit" | "withdraw";
  projectSlug?: string;
  amountUSD: number;
  atISO: string;
  atMs: number;
};

export default function MyHistoryPage() {
  return (
    <>
      <AuthHeader homeHref="/app" />
      <div className="flex flex-1 relative">
        <Sidebar variant="kommitter" />
        <main className="flex-1 lg:ml-64 pb-24 max-w-[calc(80rem-16rem)] w-full">
          <AuthGate
            anonHeadline="Sign in to see your history."
            anonBody="Every kommit and withdrawal you've made — with the kommits earned along the way."
          >
            <HistoryBody />
          </AuthGate>
        </main>
      </div>
      <Footer withSidebarOffset />
    </>
  );
}

function HistoryBody() {
  const { user, isSignedIn } = useAuth();
  const isDemo = useDemoMode();
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [activity, setActivity] = useState<DemoActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // On-chain commitments (works for both demo and real-Privy via the
  // demo-fixtures fast path). Active positions feed the "active committed"
  // stat and — in real-Privy mode where there's no engagement log — also
  // synthesize the activity rows.
  useEffect(() => {
    if (!isSignedIn || !user?.wallet) {
      setCommitments([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getCommitmentsForUser(user.wallet)
      .then((c) => {
        if (!cancelled) setCommitments(c);
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.warn("history commitments read failed:", e);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, user?.wallet]);

  // Demo activity log — empty in real-Privy mode, populated in demo mode
  // with the full kommit/withdraw/etc trail. Kept in sync with same-tab
  // mutations via the storage event.
  useEffect(() => {
    if (!isDemo || !user?.wallet) {
      setActivity([]);
      return;
    }
    setActivity(getDemoActivity(user.wallet, 200));
    const onStorage = () => setActivity(getDemoActivity(user.wallet ?? "", 200));
    if (typeof window !== "undefined") {
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    }
  }, [isDemo, user?.wallet]);

  const entries = useMemo<HistoryEntry[]>(() => {
    if (isDemo) {
      // Filter to value-moving entries; keep newest first as stored.
      return activity
        .filter((e) => e.kind === "commit" || e.kind === "withdraw")
        .map((e) => ({
          kind: e.kind as "commit" | "withdraw",
          projectSlug: e.projectSlug,
          amountUSD: e.amountUSD ?? 0,
          atISO: e.atISO,
          atMs: new Date(e.atISO).getTime(),
        }));
    }
    // Real-Privy fallback: each active commitment becomes one "Kommitted"
    // row. Withdraw events aren't surfaced — the program emits them but
    // there's no indexer in v0.1, so we'd need to crawl signatures and
    // parse logs to reconstruct them. Acceptable: the recording flow is
    // an airdrop → kommit story, not a withdraw-heavy one.
    return commitments
      .map((c) => ({
        kind: "commit" as const,
        projectSlug: c.projectSlug,
        amountUSD: c.kommittedUSD,
        atISO: c.sinceISO,
        atMs: c.sinceMs ?? parseISODate(c.sinceISO).getTime(),
      }))
      .sort((a, b) => b.atMs - a.atMs);
  }, [isDemo, activity, commitments]);

  const lifetimeKommits = useLiveKommitsTotal(commitments);
  const activeUSD = commitments.reduce((acc, c) => acc + c.kommittedUSD, 0);
  const totalDepositsUSD = useMemo(() => {
    if (isDemo) {
      return entries
        .filter((e) => e.kind === "commit")
        .reduce((acc, e) => acc + e.amountUSD, 0);
    }
    // Real-Privy: lifetime ≈ active (no withdraw history available).
    return activeUSD;
  }, [isDemo, entries, activeUSD]);
  const projectsBacked = useMemo(() => {
    const slugs = new Set<string>();
    for (const c of commitments) slugs.add(c.projectSlug);
    return slugs.size;
  }, [commitments]);

  const topProject = useMemo(() => {
    if (commitments.length === 0) return null;
    let best: Commitment | null = null;
    for (const c of commitments) {
      if (!best || c.kommittedUSD > best.kommittedUSD) best = c;
    }
    return best;
  }, [commitments]);

  return (
    <div className="px-6 md:px-12">
      <section className="mt-12 md:mt-16">
        <h1 className="font-epilogue font-black uppercase text-4xl md:text-6xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit">
          My history
        </h1>
        <p className="mt-5 max-w-2xl text-base font-medium text-gray-700 leading-relaxed">
          Every kommit and withdrawal on this wallet. Newest first.
        </p>
      </section>

      <section className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        <StatCard
          label="Lifetime kommits"
          value={lifetimeKommits > 0 ? formatLiveKommits(lifetimeKommits) : formatNumber(0)}
          hint="non-transferable · yours forever"
          accent
          live
        />
        <StatCard
          label="Active committed"
          value={formatUSD(activeUSD)}
          hint={
            commitments.length === 0
              ? "no kommitments yet"
              : `across ${commitments.length} project${commitments.length === 1 ? "" : "s"}`
          }
        />
        <StatCard
          label="Total deposited"
          value={formatUSD(totalDepositsUSD)}
          hint={isDemo ? "lifetime money placed" : "currently active"}
        />
        <StatCard
          label="Projects backed"
          value={formatNumber(projectsBacked)}
          hint={
            topProject
              ? `top: ${getProject(topProject.projectSlug)?.name ?? topProject.projectSlug}`
              : "back one to begin"
          }
        />
      </section>

      <section className="mt-16 pt-10 border-t-[8px] border-black">
        <h2 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit mb-8">
          Activity
        </h2>

        {loading && entries.length === 0 ? (
          <ActivitySkeleton />
        ) : entries.length === 0 ? (
          <EmptyHistory />
        ) : (
          <PaginatedList
            items={entries}
            defaultLimit={25}
            itemKey={(e, i) => `${e.atISO}-${e.kind}-${e.projectSlug ?? "x"}-${i}`}
            renderItem={(e) => <HistoryRow entry={e} />}
            expandLabel={(hidden) => `Show more (${hidden})`}
          />
        )}
      </section>

      {commitments.length > 0 ? (
        <section className="mt-16 pt-10 border-t-[8px] border-black">
          <h2 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit mb-8">
            By project
          </h2>
          <div className="space-y-3">
            {[...commitments]
              .sort((a, b) => b.kommittedUSD - a.kommittedUSD)
              .map((c) => (
                <ProjectBreakdownRow key={c.projectSlug} commitment={c} />
              ))}
          </div>
        </section>
      ) : null}

      <div className="mt-20 pt-8 border-t-[2px] border-black">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 font-epilogue font-bold uppercase tracking-widest text-xs text-gray-600 hover:text-black"
        >
          <Icon name="arrow_back" size="sm" />
          Back to your kommits
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  accent,
  live,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  live?: boolean;
}) {
  return (
    <div className="bg-white border-[3px] border-black shadow-brutal p-5 md:p-6">
      <div className="font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest">
        {label}
      </div>
      <div
        className={cn(
          "mt-2 font-epilogue font-black text-3xl md:text-4xl tracking-tighter",
          accent ? "text-primary" : "",
          live ? "tabular-nums" : "",
        )}
        aria-live={live ? "polite" : undefined}
      >
        {value}
      </div>
      {hint ? (
        <div className="mt-2 font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-tight truncate">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

const KIND_META: Record<HistoryEntry["kind"], { icon: IconName; label: string; color: string; border: string }> = {
  commit: {
    icon: "add",
    label: "Kommitted",
    color: "bg-primary text-white",
    border: "border-black",
  },
  withdraw: {
    icon: "remove",
    label: "Withdrew",
    color: "bg-white text-black",
    border: "border-gray-400",
  },
};

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const meta = KIND_META[entry.kind];
  const project = entry.projectSlug ? getProject(entry.projectSlug) : null;
  return (
    <div
      className={cn(
        "bg-white border-[3px] p-4 flex items-center gap-4",
        meta.border,
      )}
    >
      <span
        className={cn(
          "shrink-0 w-10 h-10 border-[2px] border-black flex items-center justify-center",
          meta.color,
        )}
      >
        <Icon name={meta.icon} size="sm" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-epilogue font-bold uppercase text-xs md:text-sm tracking-tight">
          {meta.label}{" "}
          <span className="font-black">{formatUSD(entry.amountUSD)}</span>
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
          ) : null}
        </div>
        <div className="font-epilogue font-medium text-[10px] uppercase tracking-widest text-gray-500">
          {relativeTime(entry.atISO.slice(0, 10))}
        </div>
      </div>
    </div>
  );
}

function ProjectBreakdownRow({ commitment }: { commitment: Commitment }) {
  const project = getProject(commitment.projectSlug);
  const kommits = useLiveKommits(
    commitment.kommittedUSD,
    commitment.sinceISO,
    commitment.sinceMs,
    undefined,
    commitment.frozenKommits,
  );
  if (!project) return null;
  return (
    <Link
      href={`/projects/${project.slug}`}
      className="block bg-white border-[3px] border-black p-4 hover:bg-secondary transition-colors"
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="font-epilogue font-black uppercase text-base tracking-tight truncate">
            {project.name}
          </div>
          <div className="mt-1 font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest">
            since {relativeTime(commitment.sinceISO)}
          </div>
        </div>
        <div className="flex items-baseline gap-6 shrink-0">
          <div className="text-right">
            <div className="font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest">
              committed
            </div>
            <div className="font-epilogue font-black text-lg tracking-tight">
              {formatUSD(commitment.kommittedUSD)}
            </div>
          </div>
          <div className="text-right">
            <div className="font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest">
              kommits
            </div>
            <div className="font-epilogue font-black text-lg text-primary tabular-nums tracking-tight">
              {formatLiveKommits(kommits)}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function ActivitySkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-gray-100 border-[3px] border-black h-16 animate-pulse"
        />
      ))}
    </div>
  );
}

function EmptyHistory() {
  return (
    <div className="bg-white border-[3px] border-black shadow-brutal p-8 text-center">
      <p className="font-epilogue font-black uppercase text-2xl tracking-tighter mb-3">
        No history yet.
      </p>
      <p className="text-sm font-medium text-gray-700 mb-6 max-w-md mx-auto">
        Once you kommit or withdraw, the trail lands here.
      </p>
      <Link
        href="/projects"
        className="inline-flex items-center gap-2 bg-primary text-white font-epilogue font-black uppercase tracking-tight text-sm px-6 py-3 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform"
      >
        Browse projects
        <Icon name="arrow_forward" size="sm" />
      </Link>
    </div>
  );
}
