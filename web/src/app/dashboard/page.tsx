"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { AuthHeader } from "@/components/layout/AuthHeader";
import { Footer } from "@/components/layout/Footer";
import { Sidebar } from "@/components/layout/Sidebar";
import { CommitmentRow } from "@/components/dashboard/CommitmentRow";
import { RightRail } from "@/components/dashboard/RightRail";
import { useAuth } from "@/components/auth/AuthProvider";
import { AuthGate } from "@/components/auth/AuthGate";
import { getCommitmentsForUser } from "@/lib/queries";
import { getProject } from "@/lib/data/projects";
import { parseISODate } from "@/lib/date-utils";
import type { Commitment } from "@/lib/data/commitments";
import { formatNumber, formatUSD } from "@/lib/kommit-math";
import { useLiveKommitsTotal, formatLiveKommits } from "@/lib/hooks/useLiveKommits";
import { useDemoMode } from "@/lib/demo-mode";
import { getDemoBalance } from "@/lib/demo-engagement";
import { useSandboxBalance } from "@/lib/hooks/useSandboxBalance";
import { Icon } from "@/components/common/Icon";
import { cn } from "@/lib/cn";
import { DepositModal } from "@/components/account/DepositModal";

type DashboardSortKey = "kommitted" | "kommits" | "recent" | "alphabetical";
const DASHBOARD_SORT_LABELS: Record<DashboardSortKey, string> = {
  kommitted: "Most kommitted",
  kommits: "Most kommits",
  recent: "Newest",
  alphabetical: "A → Z",
};
const DASHBOARD_DEFAULT_SORT: DashboardSortKey = "kommitted";
const MS_PER_HOUR = 3_600_000;

export default function DashboardPage() {
  const { user, isSignedIn } = useAuth();
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [depositOpen, setDepositOpen] = useState(false);
  const [sortKey, setSortKey] = useState<DashboardSortKey>(DASHBOARD_DEFAULT_SORT);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

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
        if (cancelled) return;
        // Join pivot history from project metadata so the inline `↳ Pivoted Mar 04`
        // tag still renders on commitments where the project pivoted after the
        // user's deposit. Audit fix #6.
        const enriched = c.map((commitment) => {
          const project = getProject(commitment.projectSlug);
          const pivotSince = project?.updates.find(
            (u) => u.isPivot && u.atISO >= commitment.sinceISO,
          )?.atISO;
          return pivotSince ? { ...commitment, pivotedAtISO: pivotSince } : commitment;
        });
        setCommitments(enriched);
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.warn("dashboard commitments read failed:", e);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, user?.wallet, refreshKey]);

  const activeUSD = commitments.reduce((acc, c) => acc + c.kommittedUSD, 0);
  // Hydrate per-position freeze caps from project metadata (graduation date)
  // before passing into the lifetime-kommits sum. Handoff 65 B2: withdrawn
  // positions carry their own `withdrawnAtMs` + `frozenKommits` snapshot;
  // graduated projects freeze at `graduatedAtISO` for every kommitter.
  const positionsForTotal = commitments.map((c) => {
    const project = getProject(c.projectSlug);
    const graduatedAtMs = project?.graduatedAtISO
      ? new Date(`${project.graduatedAtISO}T00:00:00Z`).getTime()
      : undefined;
    const freezeAtMs =
      graduatedAtMs != null && c.withdrawnAtMs != null
        ? Math.min(graduatedAtMs, c.withdrawnAtMs)
        : graduatedAtMs ?? c.withdrawnAtMs;
    return {
      kommittedUSD: c.kommittedUSD,
      sinceISO: c.sinceISO,
      sinceMs: c.sinceMs,
      freezeAtMs,
      frozenKommits: c.frozenKommits,
    };
  });
  const liveTotalKommits = useLiveKommitsTotal(positionsForTotal);
  const isDemo = useDemoMode();
  // In real-Privy mode the available balance is the user's sandbox SPL
  // balance on devnet (post-/demo on-chain entry, that's the $10K airdrop).
  // Demo mode keeps reading the localStorage-backed simulated balance.
  const sandboxBalance = useSandboxBalance(
    !isDemo && isSignedIn ? user?.wallet ?? null : null,
    refreshKey,
  );
  const [demoBalance, setDemoBalance] = useState<number | null>(null);
  useEffect(() => {
    if (!isSignedIn || !user?.wallet) {
      setDemoBalance(null);
      return;
    }
    if (isDemo) setDemoBalance(getDemoBalance(user.wallet));
    else setDemoBalance(null);
  }, [isSignedIn, user?.wallet, isDemo, refreshKey]);
  const availableUSD = isDemo ? demoBalance : sandboxBalance;

  // Sorted view of the user's positions. The lifetime-kommits sort uses the
  // same additive formula as the row display (live + frozen) so the order
  // lines up with what the user sees on each row. Snapshot at render-tick —
  // we deliberately don't re-sort every second, because the per-second
  // accrual delta is tiny (kommittedUSD / 3600 per sec) and continuous
  // re-ordering would feel noisy.
  const sortedCommitments = useMemo(() => {
    const now = Date.now();
    const withScore = commitments.map((c) => {
      const project = getProject(c.projectSlug);
      const graduatedAtMs = project?.graduatedAtISO
        ? new Date(`${project.graduatedAtISO}T00:00:00Z`).getTime()
        : undefined;
      const freezeAtMs =
        graduatedAtMs != null && c.withdrawnAtMs != null
          ? Math.min(graduatedAtMs, c.withdrawnAtMs)
          : graduatedAtMs ?? c.withdrawnAtMs;
      const sinceMs = c.sinceMs ?? parseISODate(c.sinceISO).getTime();
      const capNow = freezeAtMs != null ? Math.min(now, freezeAtMs) : now;
      const hours = Math.max(0, (capNow - sinceMs) / MS_PER_HOUR);
      const lifetime = c.kommittedUSD * hours + (c.frozenKommits ?? 0);
      return { commitment: c, project, lifetime };
    });
    withScore.sort((a, b) => {
      switch (sortKey) {
        case "kommits":
          return b.lifetime - a.lifetime;
        case "recent":
          return b.commitment.sinceISO.localeCompare(a.commitment.sinceISO);
        case "alphabetical": {
          const an = a.project?.name ?? a.commitment.projectSlug;
          const bn = b.project?.name ?? b.commitment.projectSlug;
          return an.localeCompare(bn, "en", { sensitivity: "base" });
        }
        case "kommitted":
        default:
          return b.commitment.kommittedUSD - a.commitment.kommittedUSD;
      }
    });
    return withScore;
  }, [commitments, sortKey]);

  return (
    <>
      <AuthHeader homeHref="/app" />
      <div className="flex flex-1 relative">
        <Sidebar variant="kommitter" />
        <main className="flex-1 lg:ml-64 pb-24 max-w-[calc(80rem-16rem)] w-full">
          <AuthGate
            anonHeadline="Sign in to see your dashboard."
            anonBody="Your kommitments, kommits, and recent updates from teams you back. Nothing here for visitors."
          >
          <div className="px-6 md:px-12">
          <section className="mt-8 md:mt-16 flex items-end justify-between flex-wrap gap-4">
            <div>
              <h1 className="font-epilogue font-black uppercase text-4xl md:text-6xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit">
                Dashboard
              </h1>
            </div>
            {isSignedIn ? (
              <button
                type="button"
                onClick={() => setDepositOpen(true)}
                className="bg-secondary text-black font-epilogue font-black uppercase tracking-tight text-sm px-5 py-3 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2"
              >
                <Icon name="add" size="sm" />
                Deposit
              </button>
            ) : null}
          </section>

          {/* Handoff 78 P0-5: force 3-up on mobile so the scoreboard reads as
              the page's headline at 375. The earlier `grid-cols-1 sm:grid-cols-2`
              put only "Lifetime kommits" above the fold and pushed the first
              commitment row ~1100px down. */}
          <section className="mt-8 grid grid-cols-3 gap-2 md:gap-5">
            <StatCard
              label="Lifetime kommits"
              value={
                liveTotalKommits > 0
                  ? formatLiveKommits(liveTotalKommits)
                  : formatNumber(0)
              }
              hint="non-transferable · yours forever"
              accent
              live
            />
            <StatCard
              label="Active committed"
              value={formatUSD(activeUSD)}
              hint={
                commitments.length > 0
                  ? `across ${commitments.length} project${commitments.length === 1 ? "" : "s"}`
                  : isSignedIn
                    ? "no kommitments yet"
                    : "sign in to see your kommits"
              }
            />
            <StatCard
              label="Available to kommit"
              value={availableUSD !== null ? formatUSD(availableUSD) : "—"}
              hint={
                availableUSD !== null
                  ? "ready to deploy"
                  : "Deposit to fund your kommits"
              }
            />
          </section>

          <div className="mt-20 grid grid-cols-1 lg:grid-cols-[1fr_minmax(320px,400px)] gap-10">
            <div className="space-y-20">
              <section className="pt-10 border-t-[8px] border-black">
                <div className="mb-8 flex items-end justify-between flex-wrap gap-3">
                  <h2 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit">
                    Your kommits
                  </h2>
                  {isSignedIn && commitments.length > 1 ? (
                    <DashboardSortDropdown value={sortKey} onChange={setSortKey} />
                  ) : null}
                </div>
                {!isSignedIn ? (
                  <SignInPrompt />
                ) : loading ? (
                  <CommitmentsSkeleton />
                ) : commitments.length === 0 ? (
                  <EmptyCommitments />
                ) : (
                  <div className="space-y-5">
                    {sortedCommitments.map(({ commitment: c, project }) => {
                      if (!project) return null;
                      return (
                        <CommitmentRow
                          key={c.projectSlug}
                          commitment={c}
                          project={project}
                          onWithdrawSuccess={refresh}
                        />
                      );
                    })}
                  </div>
                )}
              </section>

            </div>

            <aside className="lg:pt-10 lg:border-t-[8px] lg:border-black space-y-6">
              <RightRail commitments={commitments} />
            </aside>
          </div>

          <div className="mt-20 pt-8 border-t-[2px] border-black">
            <Link
              href="/projects"
              className="inline-flex items-center gap-2 font-epilogue font-bold uppercase tracking-widest text-xs text-gray-600 hover:text-black"
            >
              Browse all projects
              <Icon name="arrow_forward" size="sm" />
            </Link>
          </div>
          </div>
          </AuthGate>
        </main>
      </div>
      <Footer withSidebarOffset />
      <DepositModal
        open={depositOpen}
        onOpenChange={setDepositOpen}
        onDepositSuccess={refresh}
      />
    </>
  );
}

function DashboardSortDropdown({
  value,
  onChange,
}: {
  value: DashboardSortKey;
  onChange: (k: DashboardSortKey) => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="bg-white text-black font-epilogue font-black uppercase text-sm tracking-tight px-4 py-2 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform flex items-center gap-2"
        >
          <span className="font-epilogue font-bold text-gray-500 text-xs">
            Sort by
          </span>
          <span>{DASHBOARD_SORT_LABELS[value]}</span>
          <Icon name="expand_more" size="sm" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="bg-white border-[3px] border-black shadow-brutal min-w-[180px] p-2 z-[60]"
        >
          {(Object.keys(DASHBOARD_SORT_LABELS) as DashboardSortKey[]).map(
            (key) => (
              <DropdownMenu.Item
                key={key}
                onSelect={() => onChange(key)}
                className={cn(
                  "px-3 py-2 font-epilogue font-bold uppercase text-sm tracking-tight cursor-pointer outline-none",
                  value === key
                    ? "bg-primary text-white"
                    : "data-[highlighted]:bg-gray-100",
                )}
              >
                {DASHBOARD_SORT_LABELS[key]}
              </DropdownMenu.Item>
            ),
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function SignInPrompt() {
  return (
    <div className="bg-white border-[3px] border-black shadow-brutal p-8 text-center">
      <p className="font-epilogue font-black uppercase text-2xl tracking-tighter mb-4">
        Sign in to see your kommits.
      </p>
      <Link
        href="/projects"
        className="inline-flex items-center gap-2 bg-white text-black font-epilogue font-black uppercase tracking-tight text-sm px-6 py-3 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform"
      >
        Browse projects
        <Icon name="arrow_forward" size="sm" />
      </Link>
    </div>
  );
}

function EmptyCommitments() {
  return (
    <div className="bg-white border-[3px] border-black shadow-brutal p-8 text-center">
      <p className="font-epilogue font-black uppercase text-2xl tracking-tighter mb-4">
        No commitments yet.
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

function CommitmentsSkeleton() {
  return (
    <div className="space-y-5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="bg-gray-100 border-[3px] border-black shadow-brutal h-24 animate-pulse"
        />
      ))}
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
    <div className="bg-white border-[3px] border-black shadow-brutal p-3 md:p-6">
      <div className="font-epilogue font-bold uppercase text-[9px] md:text-[10px] text-gray-500 tracking-wider md:tracking-widest leading-tight">
        {label}
      </div>
      <div
        className={`mt-1.5 md:mt-2 font-epilogue font-black text-xl md:text-5xl tracking-tighter tabular-nums ${accent ? "text-primary" : ""}`}
        aria-live={live ? "polite" : undefined}
      >
        {value}
      </div>
      {hint ? (
        <div className="mt-1.5 md:mt-2 font-epilogue font-bold uppercase text-[9px] md:text-[10px] text-gray-500 tracking-tight leading-tight hidden md:block">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
