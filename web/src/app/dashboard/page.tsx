"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AuthHeader } from "@/components/layout/AuthHeader";
import { Footer } from "@/components/layout/Footer";
import { Sidebar } from "@/components/layout/Sidebar";
import { CommitmentRow } from "@/components/dashboard/CommitmentRow";
import { ActivityHistory } from "@/components/dashboard/ActivityHistory";
import { RightRail } from "@/components/dashboard/RightRail";
import { useAuth } from "@/components/auth/AuthProvider";
import { AuthGate } from "@/components/auth/AuthGate";
import { getCommitmentsForUser } from "@/lib/queries";
import { getProject } from "@/lib/data/projects";
import type { Commitment } from "@/lib/data/commitments";
import { formatNumber, formatUSD } from "@/lib/kommit-math";
import { useLiveKommitsTotal, formatLiveKommits } from "@/lib/hooks/useLiveKommits";
import { useDemoMode } from "@/lib/demo-mode";
import { getDemoBalance } from "@/lib/demo-engagement";
import { useVisaMode, formatEUR } from "@/lib/visa-mode";
import { Icon } from "@/components/common/Icon";
import { DepositModal } from "@/components/account/DepositModal";

export default function DashboardPage() {
  const { user, isSignedIn } = useAuth();
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [depositOpen, setDepositOpen] = useState(false);

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
  const liveTotalKommits = useLiveKommitsTotal(commitments);
  const isDemo = useDemoMode();
  const isVisa = useVisaMode();
  const [availableUSD, setAvailableUSD] = useState<number | null>(null);
  useEffect(() => {
    if (!isSignedIn || !user?.wallet) {
      setAvailableUSD(null);
      return;
    }
    if (isDemo) setAvailableUSD(getDemoBalance(user.wallet));
    else setAvailableUSD(null); // TODO: live USDC balance via wallet machinery
  }, [isSignedIn, user?.wallet, isDemo, refreshKey]);

  // In visa mode the dashboard reads in EUR. The kommit *score* stays
  // unitless (kommits are kommits), but every dollar amount converts to a
  // EUR display; the localStorage positions are still keyed in USDC.
  const fmtMoney = (usdc: number) => (isVisa ? formatEUR(usdc) : formatUSD(usdc));

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
          {isVisa ? (
            <div className="mt-8 mb-4 flex items-center justify-between flex-wrap gap-2">
              <span className="inline-block bg-secondary text-black font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black shadow-brutal-sm">
                Sandbox preview
              </span>
              <Link
                href="/visa-demo"
                className="font-epilogue font-bold uppercase tracking-widest text-[10px] text-gray-500 hover:text-black"
              >
                Exit demo →
              </Link>
            </div>
          ) : null}
          <section className="mt-12 md:mt-16 flex items-end justify-between flex-wrap gap-4">
            <div>
              <h1 className="font-epilogue font-black uppercase text-4xl md:text-6xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit">
                Your kommits
              </h1>
              {isVisa ? (
                <p className="mt-3 font-epilogue font-bold uppercase text-[11px] text-gray-600 tracking-widest">
                  Card-funded · settled on-chain
                </p>
              ) : null}
            </div>
            {isSignedIn && !isVisa ? (
              <button
                type="button"
                onClick={() => setDepositOpen(true)}
                className="bg-secondary text-black font-epilogue font-black uppercase tracking-tight text-sm px-5 py-3 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2"
              >
                <Icon name="add" size="sm" />
                Deposit
              </button>
            ) : isSignedIn && isVisa ? (
              <Link
                href="/visa-demo"
                className="bg-secondary text-black font-epilogue font-black uppercase tracking-tight text-sm px-5 py-3 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform flex items-center gap-2"
              >
                <Icon name="add" size="sm" />
                Add to your kommit
              </Link>
            ) : null}
          </section>

          <section className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
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
              label={isVisa ? "Currently committed" : "Active committed"}
              value={fmtMoney(activeUSD)}
              hint={
                commitments.length > 0
                  ? `across ${commitments.length} project${commitments.length === 1 ? "" : "s"}`
                  : isSignedIn
                    ? "no kommitments yet"
                    : "sign in to see your kommits"
              }
            />
            <StatCard
              label={isVisa ? "Available to kommit" : "Available to kommit"}
              value={availableUSD !== null ? fmtMoney(availableUSD) : "—"}
              hint={
                availableUSD !== null
                  ? isVisa
                    ? "settled on-chain · ready to deploy"
                    : isDemo
                      ? "ready to deploy"
                      : "USDC in your wallet"
                  : "Deposit to fund your kommits"
              }
            />
          </section>

          <div className="mt-20 grid grid-cols-1 lg:grid-cols-[1fr_minmax(320px,400px)] gap-10">
            <div className="space-y-20">
              <section className="pt-10 border-t-[8px] border-black">
                <h2 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit mb-8">
                  Your commitments
                </h2>
                {!isSignedIn ? (
                  <SignInPrompt />
                ) : loading ? (
                  <CommitmentsSkeleton />
                ) : commitments.length === 0 ? (
                  <EmptyCommitments />
                ) : (
                  <div className="space-y-5">
                    {commitments.map((c) => {
                      const project = getProject(c.projectSlug);
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

              {isSignedIn && user?.wallet && isDemo ? (
                <section className="pt-10 border-t-[8px] border-black">
                  <h2 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit mb-8">
                    My history
                  </h2>
                  <ActivityHistory
                    wallet={user.wallet}
                    kinds={["commit", "withdraw"]}
                    defaultLimit={10}
                    emptyHeadline="No history yet."
                    emptyBody="Your kommits and withdrawals land here as you act."
                  />
                </section>
              ) : null}
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
      <DepositModal open={depositOpen} onOpenChange={setDepositOpen} />
    </>
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
    <div className="bg-white border-[3px] border-black shadow-brutal p-6">
      <div className="font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest">
        {label}
      </div>
      <div
        className={`mt-2 font-epilogue font-black text-4xl md:text-5xl tracking-tighter ${accent ? "text-primary" : ""} ${live ? "tabular-nums" : ""}`}
        aria-live={live ? "polite" : undefined}
      >
        {value}
      </div>
      {hint ? (
        <div className="mt-2 font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-tight">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
