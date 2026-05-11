"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthHeader } from "@/components/layout/AuthHeader";
import { AuthGate } from "@/components/auth/AuthGate";
import { Footer } from "@/components/layout/Footer";
import { Sidebar } from "@/components/layout/Sidebar";
import { BrutalSelect } from "@/components/common/BrutalSelect";
import { PostUpdateEditor } from "@/components/founder/PostUpdateEditor";
import { kommitsFor, formatNumber, formatUSD } from "@/lib/kommit-math";
import { shortDate, daysBetween, longDate } from "@/lib/date-utils";
import { avatarUrl, walletDisplayName } from "@/lib/data/users";
import type { Project, ProjectKommitter } from "@/lib/data/projects";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/common/Icon";
import { findProjectPda } from "@/lib/kommit";
import { PublicKey } from "@solana/web3.js";
import type { RemoteUpdate } from "@/lib/api-types";
import { useLiveKommitsTotal, formatLiveKommits } from "@/lib/hooks/useLiveKommits";
import {
  DEMO_BACKER_NOTES_STORAGE_KEY,
  listBackerNotes,
  type BackerNote,
} from "@/lib/demo-engagement";
import {
  buildLiveCohortPositions,
  getCohortGrowth,
  getGeographicDistribution,
  getKommitSizeStats,
  getRetentionThroughPivots,
  SPARKLINE_DAYS,
} from "@/lib/data/mock-analytics";
// kommit.now is the first integrator of its own public on-chain reader.
// `@kommitapp/reader` is open-source and `npm install`-able by any Solana
// product that wants to gate features on real conviction. The cohort
// section below reads through `getKommittersForProject` exactly as the
// SDK README documents — no internal shortcut, no internal-only field.
//
//   npm install @kommitapp/reader
//   import { getKommittersForProject } from "@kommitapp/reader";
//
// Source: app/packages/kommit-reader/. Full README at the package root.
import {
  getKommittersForProject,
  type KommitRecord,
} from "@kommitapp/reader";

type SortKey = "recent" | "kommitted" | "kommits";

const PAGE_SIZE = 7;

export function FounderDashboardClient({ project }: { project: Project }) {
  const [postedUpdates, setPostedUpdates] = useState<RemoteUpdate[]>([]);
  const [sort, setSort] = useState<SortKey>("recent");
  const [shown, setShown] = useState(PAGE_SIZE);

  const projectPda = useMemo(() => {
    if (!project.recipientWallet) return null;
    try {
      return findProjectPda(new PublicKey(project.recipientWallet)).toBase58();
    } catch {
      return null;
    }
  }, [project.recipientWallet]);

  const sortedKommitters = useMemo(
    () => sortKommitters(project.kommitters, sort),
    [project.kommitters, sort],
  );
  const visible = sortedKommitters.slice(0, shown);

  // Headline cohort numbers come from project-level totals (the system of record).
  // The enumerated kommitters list is a subset for display.
  const totalUSD = project.totalKommittedUSD;
  const totalKommits = project.totalKommitsGenerated;

  // Average commitment age across the enumerated kommitters — feeds the
  // detail-view kommitter list, kept for parity with the old "Your backers"
  // stat strip even though it's no longer in the headline. Null when we
  // have no kommitters to average.
  const avgAgeDays = useMemo(() => {
    if (project.kommitters.length === 0) return null;
    const total = project.kommitters.reduce(
      (acc, k) => acc + daysBetween(k.sinceISO),
      0,
    );
    return Math.round(total / project.kommitters.length);
  }, [project.kommitters]);

  return (
    <>
      <AuthHeader homeHref="/app" />
      <div className="flex flex-1 relative">
        <Sidebar
          variant="founder"
          founderSlug={project.slug}
          founderKommittersCount={project.kommittersCount}
        />
        <main className="flex-1 lg:ml-64 pb-24 max-w-[calc(80rem-16rem)] w-full">
          <AuthGate
            requireOwnsProject={project.slug}
            anonHeadline="Sign in to manage your project."
            anonBody="The founder console — kommitters, post-update editor, cohort numbers — is the team's private view."
          >
            <div className="px-6 md:px-12">
              <section id="overview" className="mt-12 md:mt-16">
                <div className="flex items-center gap-3 flex-wrap mb-3">
                  <span className="inline-block bg-primary text-white font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black shadow-brutal-sm">
                    {project.sector}
                  </span>
                  <Link
                    href={`/projects/${project.slug}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest hover:text-black"
                  >
                    View public page <Icon name="arrow_outward" size="xs" />
                  </Link>
                </div>
                <h1 className="font-epilogue font-black uppercase text-4xl md:text-6xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit">
                  {project.name}
                </h1>
                <p className="mt-5 max-w-xl text-base font-medium text-gray-700 leading-relaxed">
                  {project.pitch}
                </p>
              </section>

              <section
                id="post-update"
                className="mt-20 pt-10 border-t-[8px] border-black"
              >
                <h2 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit mb-8">
                  Post an update
                </h2>
                {projectPda ? (
                  <PostUpdateEditor
                    projectPda={projectPda}
                    onPosted={(u) =>
                      setPostedUpdates((cur) => [u, ...cur])
                    }
                  />
                ) : (
                  <div className="bg-white border-[3px] border-black shadow-brutal p-6 max-w-3xl">
                    <p className="font-epilogue font-bold uppercase text-sm tracking-tight">
                      This project isn&rsquo;t open for kommitments yet —
                      posting is disabled until the onchain account exists.
                    </p>
                  </div>
                )}

                {postedUpdates.length > 0 ? (
                  <div className="mt-8 max-w-3xl">
                    <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest mb-3">
                      Just posted
                    </div>
                    <ul className="space-y-3">
                      {postedUpdates.map((u) => (
                        <li
                          key={u.id}
                          className={cn(
                            "bg-white border-[3px] border-black p-4",
                            u.is_pivot ? "shadow-brutal-purple" : "shadow-brutal",
                          )}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest">
                              {longDate(u.posted_at.slice(0, 10))}
                            </span>
                            {u.is_pivot ? (
                              <span className="bg-primary text-white px-2 py-0.5 border-[2px] border-black uppercase text-[9px] font-epilogue font-black tracking-widest">
                                Pivot
                              </span>
                            ) : null}
                          </div>
                          <div className="font-epilogue font-black uppercase text-base tracking-tight">
                            {u.title}
                          </div>
                          {u.body && u.body !== u.title ? (
                            <p className="mt-1 text-sm font-medium text-gray-700">
                              {u.body}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>

              <YourCohortSection
                project={project}
                projectPda={projectPda}
                totalUSD={totalUSD}
                totalKommits={totalKommits}
                avgAgeDays={avgAgeDays}
                sort={sort}
                setSort={setSort}
                visible={visible}
                sortedCount={sortedKommitters.length}
                shown={shown}
                setShown={setShown}
              />

              <BackerNotesSection projectSlug={project.slug} />

              <ComingV1Section />
            </div>
          </AuthGate>
        </main>
      </div>
      <Footer withSidebarOffset />
    </>
  );
}

/**
 * "Your cohort" — combines the headline stat strip, mocked analytics
 * panel, and the detail-view kommitter list. Replaces the prior
 * `Your kommitters` + `Your backers` duplication.
 */
function YourCohortSection({
  project,
  projectPda,
  totalUSD,
  totalKommits,
  avgAgeDays,
  sort,
  setSort,
  visible,
  sortedCount,
  shown,
  setShown,
}: {
  project: Project;
  projectPda: string | null;
  totalUSD: number;
  totalKommits: number;
  avgAgeDays: number | null;
  sort: SortKey;
  setSort: (k: SortKey) => void;
  visible: ProjectKommitter[];
  sortedCount: number;
  shown: number;
  setShown: (next: number | ((cur: number) => number)) => void;
}) {
  // Live-ticking cohort total. Builds a single synthetic position whose
  // sinceMs is back-dated so the formula lands on the static
  // `totalKommitsGenerated` at mount, then ticks at the right rate.
  const livePositions = useMemo(
    () => buildLiveCohortPositions(totalUSD, totalKommits),
    [totalUSD, totalKommits],
  );
  const liveTotal = useLiveKommitsTotal(livePositions);
  const liveDisplay =
    liveTotal > 0 ? formatLiveKommits(liveTotal) : formatNumber(totalKommits);

  const pivotUpdate = project.updates.find((u) => u.isPivot);
  const retention = getRetentionThroughPivots(
    project.slug,
    pivotUpdate?.atISO ?? null,
  );

  return (
    <section id="cohort" className="mt-20 pt-10 border-t-[8px] border-black">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <h2 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit">
          Your cohort
        </h2>
        <p className="font-epilogue font-medium text-xs text-gray-500 max-w-sm">
          Cohort summary fed by{" "}
          <span className="font-epilogue font-bold uppercase tracking-widest text-[10px] text-black">
            @kommitapp/reader
          </span>
          . Analytics panel mocked for v0.5 — swap-in when the indexer ships.
        </p>
      </div>

      {/* Hero stat strip — 4 cards. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        <FounderStat
          label="Currently kommitted"
          value={formatUSD(totalUSD)}
          hint={`${project.kommittersCount} kommitter${project.kommittersCount === 1 ? "" : "s"}`}
          accent
        />
        <FounderStat
          label="Total kommits earned"
          value={liveDisplay}
          hint="live · capital × time"
        />
        <FounderStat
          label="Kommitter count"
          value={formatNumber(project.kommittersCount)}
          hint={
            avgAgeDays !== null
              ? `avg ${avgAgeDays}d backing`
              : "active cohort"
          }
        />
        <FounderStat
          label="Retention thru pivots"
          value={retention.percent !== null ? `${retention.percent}%` : "—"}
          hint={retention.caption}
        />
      </div>

      {/* Analytics panel. */}
      <CohortAnalyticsPanel project={project} />

      {/* Kommitter list — demoted to detail view. */}
      <div className="mt-12">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
          <h3 className="font-epilogue font-black uppercase text-xl md:text-2xl tracking-tight">
            Kommitter list
          </h3>
          <label className="flex items-center gap-3">
            <span className="font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest">
              Sort
            </span>
            <BrutalSelect
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              <option value="recent">Most recent</option>
              <option value="kommitted">Most kommitted</option>
              <option value="kommits">Most kommits</option>
            </BrutalSelect>
          </label>
        </div>
        {project.kommitters.length === 0 ? (
          <FounderEmptyKommittersState slug={project.slug} />
        ) : (
          <>
            <div className="space-y-4">
              {visible.map((k, i) => (
                <KommitterRow key={i} kommitter={k} />
              ))}
            </div>
            <div className="mt-8 flex items-center justify-between flex-wrap gap-4">
              <p className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest">
                Showing {Math.min(shown, sortedCount)} of{" "}
                {project.kommittersCount}
              </p>
              {shown < sortedCount ? (
                <button
                  type="button"
                  onClick={() => setShown((s) => s + 25)}
                  className="bg-white text-black font-epilogue font-black uppercase tracking-tight text-sm px-5 py-3 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform flex items-center gap-2"
                >
                  Load 25 more
                  <Icon name="expand_more" size="sm" />
                </button>
              ) : null}
            </div>
          </>
        )}

        <OnChainCohortDrawer projectPda={projectPda} />
      </div>
    </section>
  );
}

/**
 * Mocked analytics — geographic distribution, cohort-growth sparkline,
 * average + median kommit size. All values are deterministic per project
 * (see `lib/data/mock-analytics.ts`), so refreshes never thrash the
 * numbers mid-recording.
 */
function CohortAnalyticsPanel({ project }: { project: Project }) {
  const geo = useMemo(
    () => getGeographicDistribution(project.slug),
    [project.slug],
  );
  const growth = useMemo(
    () => getCohortGrowth(project.slug, project.kommittersCount),
    [project.slug, project.kommittersCount],
  );
  const sizes = useMemo(
    () =>
      getKommitSizeStats(
        project.slug,
        project.totalKommittedUSD,
        project.kommittersCount,
      ),
    [project.slug, project.totalKommittedUSD, project.kommittersCount],
  );

  return (
    <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
      {/* Geographic distribution — bar list with flags. */}
      <article className="bg-white border-[3px] border-black shadow-brutal p-5">
        <div className="font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest mb-4">
          Geographic distribution
        </div>
        <ul className="space-y-2">
          {geo.map((r) => (
            <li key={r.code} className="flex items-center gap-2">
              <span className="text-lg leading-none" aria-hidden>
                {r.flag}
              </span>
              <span className="font-epilogue font-bold uppercase text-[11px] tracking-tight w-24 shrink-0 truncate">
                {r.label}
              </span>
              <div className="flex-1 h-3 bg-gray-100 border-[2px] border-black relative">
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 border-r-[2px] border-black",
                    r.code === "XX" ? "bg-gray-400" : "bg-primary",
                  )}
                  style={{ width: `${r.percent}%` }}
                  aria-hidden
                />
              </div>
              <span className="font-epilogue font-black text-xs tracking-tight tabular-nums w-10 text-right">
                {r.percent}%
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest">
          Mock · indexer ships v1
        </p>
      </article>

      {/* Cohort growth sparkline — last 30 days. */}
      <article className="bg-white border-[3px] border-black shadow-brutal p-5">
        <div className="font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest mb-2">
          Cohort growth · last {SPARKLINE_DAYS} days
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-epilogue font-black text-3xl md:text-4xl tracking-tighter">
            {formatNumber(project.kommittersCount)}
          </span>
          <span className="font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest">
            kommitters today
          </span>
        </div>
        <Sparkline points={growth} className="mt-4" />
        <p className="mt-3 font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest">
          Mock curve · final point exact
        </p>
      </article>

      {/* Average + median kommit size. */}
      <article className="bg-white border-[3px] border-black shadow-brutal p-5">
        <div className="font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest mb-4">
          Kommit size
        </div>
        <dl className="space-y-3">
          <SizeStatRow label="Average" value={formatUSD(sizes.averageUSD)} />
          <SizeStatRow label="Median" value={formatUSD(sizes.medianUSD)} />
          <SizeStatRow
            label="Range"
            value={`${formatUSD(sizes.minUSD)} – ${formatUSD(sizes.maxUSD)}`}
          />
        </dl>
        <p className="mt-5 font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest">
          Heavy-tail cohort · median &lt; average
        </p>
      </article>
    </div>
  );
}

function SizeStatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b-[2px] border-black pb-2 last:border-b-0 last:pb-0">
      <dt className="font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest">
        {label}
      </dt>
      <dd className="font-epilogue font-black text-xl tracking-tighter tabular-nums">
        {value}
      </dd>
    </div>
  );
}

/**
 * Minimal SVG sparkline. Computes a viewBox-relative polyline; no extra
 * dependencies. Path is drawn in primary purple with a black baseline
 * to keep the brutalist register.
 */
function Sparkline({
  points,
  className,
}: {
  points: Array<{ day: number; kommitters: number }>;
  className?: string;
}) {
  if (points.length === 0) {
    return (
      <div
        className={cn(
          "h-20 border-[2px] border-black bg-gray-50 flex items-center justify-center",
          className,
        )}
      >
        <span className="font-epilogue font-bold uppercase text-[10px] text-gray-400 tracking-widest">
          No data
        </span>
      </div>
    );
  }
  const max = Math.max(...points.map((p) => p.kommitters));
  const min = Math.min(...points.map((p) => p.kommitters));
  const range = Math.max(1, max - min);
  const w = 200;
  const h = 60;
  const pad = 2;
  const stride = (w - 2 * pad) / Math.max(1, points.length - 1);
  const coords = points.map((p, i) => {
    const x = pad + i * stride;
    const y = h - pad - ((p.kommitters - min) / range) * (h - 2 * pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const path = coords.join(" ");
  // Build a closed area fill from the polyline back to the baseline.
  const areaPath = `M ${pad},${h - pad} L ${coords.join(" L ")} L ${(w - pad).toFixed(1)},${h - pad} Z`;
  return (
    <div className={cn("border-[2px] border-black bg-gray-50 p-2", className)}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-20 block"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path d={areaPath} fill="rgb(167 139 250 / 0.25)" />
        <polyline
          points={path}
          fill="none"
          stroke="rgb(124 58 237)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={pad}
          y1={h - pad}
          x2={w - pad}
          y2={h - pad}
          stroke="black"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}

function FounderEmptyKommittersState({ slug }: { slug: string }) {
  return (
    <div className="bg-white border-[3px] border-black shadow-brutal p-10 text-center">
      <h3 className="font-epilogue font-black uppercase text-2xl tracking-tighter mb-4">
        No kommitters yet.
      </h3>
      <Link
        href={`/projects/${slug}`}
        target="_blank"
        className="inline-flex items-center gap-2 bg-primary text-white font-epilogue font-black uppercase tracking-tight text-sm px-6 py-3 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform"
      >
        Share your page
        <Icon name="arrow_outward" size="sm" />
      </Link>
    </div>
  );
}

function KommitterRow({ kommitter }: { kommitter: ProjectKommitter }) {
  const days = daysBetween(kommitter.sinceISO);
  const kommits = kommitsFor(kommitter.kommittedUSD, kommitter.sinceISO);
  return (
    <article className="bg-white border-[3px] border-black shadow-brutal p-5 grid grid-cols-1 md:grid-cols-[1.4fr_1fr_auto] gap-4 items-center">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-11 h-11 rounded-full border-[3px] border-black overflow-hidden bg-gray-100 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarUrl(kommitter.avatarSeed, 120)}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
        <div className="min-w-0">
          <div className="font-epilogue font-black text-base tracking-tight truncate">
            {kommitter.name}
          </div>
          <div className="font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest mt-0.5">
            Since {shortDate(kommitter.sinceISO)} · {days} days
          </div>
        </div>
      </div>
      <div className="font-epilogue font-bold text-sm uppercase tracking-tight">
        <span className="text-gray-500">Kommitted</span>{" "}
        <span className="font-black text-base">
          {formatUSD(kommitter.kommittedUSD)}
        </span>
      </div>
      <span className="bg-primary text-white px-3 py-1.5 border-[2px] border-black uppercase text-xs font-epilogue font-black tracking-tight inline-flex max-w-fit">
        {formatNumber(kommits)} kommits
      </span>
    </article>
  );
}

function FounderStat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-white border-[3px] border-black shadow-brutal p-6">
      <div className="font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest">
        {label}
      </div>
      <div
        className={`mt-2 font-epilogue font-black text-3xl md:text-4xl tracking-tighter ${accent ? "text-primary" : ""}`}
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

/**
 * "Backer notes" — listings of kommitters who attached a note to their
 * commit. Pulls from the demo-engagement store (matches `BackerNotes`
 * on the public project detail page). Hidden when there's nothing to
 * show so a fresh project doesn't grow an empty section.
 */
function BackerNotesSection({ projectSlug }: { projectSlug: string }) {
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
    <section
      id="backer-notes"
      className="mt-20 pt-10 border-t-[8px] border-black"
    >
      <div className="flex items-end justify-between flex-wrap gap-4 mb-2">
        <h2 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit">
          Backer notes
        </h2>
      </div>
      <p className="mb-8 font-epilogue font-medium text-sm text-gray-600 max-w-xl">
        What your kommitters wrote when they joined. Use these to spot
        recurring asks, lurking skeptics, and the lines worth quoting in your
        next update.
      </p>
      <ul className="space-y-3">
        {notes.map((n, i) => (
          <li
            key={`${n.atISO}-${i}`}
            className="bg-white border-[3px] border-black shadow-brutal p-5"
          >
            <div className="flex items-center gap-3 flex-wrap mb-3">
              <span className="font-epilogue font-black uppercase text-sm tracking-tight">
                {n.authorName || walletDisplayName(n.wallet)}
              </span>
              <span className="font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest">
                kommitted {formatUSD(n.principalUSD)}
              </span>
              <span className="font-epilogue font-bold uppercase text-[10px] text-gray-400 tracking-widest">
                · {shortDate(n.atISO.slice(0, 10))}
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

/**
 * "On the runway" — placeholder section for founder-side v1 tools that
 * aren't shipped yet. Disabled CTAs with "Coming v1" tags so founders can
 * see the direction without confusing the surface for live functionality.
 * Renamed from the old `Your cohort` placeholder so the main combined
 * section can claim that heading.
 */
function ComingV1Section() {
  const tiles: { icon: IconName; title: string; body: string }[] = [
    {
      icon: "mail",
      title: "Send a private update",
      body: "Backers-only post, separate from the public timeline. Use it for unannounced ships, internal numbers, or hard asks.",
    },
    {
      icon: "workspace_premium",
      title: "Reward top kommitters",
      body: "Allocate priority access slots manually before a raise — beta seats, founder calls, early swag.",
    },
    {
      icon: "payments",
      title: "Open a raise to your cohort",
      body: "Token sale, equity round, or SAFE — opened first to your kommitters, ranked by kommits.",
    },
    {
      icon: "groups",
      title: "Run a cohort poll",
      body: "Decision input straight from your backers. Pricing, feature direction, naming — whatever benefits from a vote.",
    },
  ];
  return (
    <section
      id="coming-v1"
      className="mt-20 pt-10 border-t-[8px] border-black"
    >
      <div className="flex items-end justify-between flex-wrap gap-4 mb-2">
        <h2 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit">
          On the runway
        </h2>
      </div>
      <p className="mb-8 font-epilogue font-medium text-sm text-gray-600 max-w-xl">
        What you&rsquo;ll be able to do with your kommitters as Kommit ships
        v1. Not live yet — these are the surfaces on the runway.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        {tiles.map((t, i) => (
          <article
            key={i}
            className="bg-white border-[3px] border-black p-5 md:p-6 relative opacity-90"
          >
            <div className="absolute top-4 right-4 inline-block bg-secondary text-black font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black shadow-brutal-sm">
              Coming v1
            </div>
            <Icon name={t.icon} size="lg" className="text-gray-700" />
            <div className="mt-3 font-epilogue font-black uppercase text-lg tracking-tight">
              {t.title}
            </div>
            <p className="mt-2 text-sm font-medium text-gray-700 leading-relaxed pr-20">
              {t.body}
            </p>
            <button
              type="button"
              disabled
              className="mt-5 bg-white text-black font-epilogue font-black uppercase tracking-tight text-xs px-4 py-2 border-[3px] border-gray-300 flex items-center gap-2 cursor-not-allowed opacity-50"
            >
              Not yet
              <Icon name="arrow_forward" size="xs" />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

/**
 * On-chain cohort drawer — folded into the kommitter list area as a
 * collapsed `<details>` instead of a parallel section. Founders who want
 * the verifiable on-chain view (via the kommit-reader SDK) can expand;
 * the demo's headline cohort numbers come from the mocked analytics +
 * seeded kommitter list.
 */
function OnChainCohortDrawer({ projectPda }: { projectPda: string | null }) {
  const [records, setRecords] = useState<KommitRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || !projectPda || records !== null || loading) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const rpcUrl =
      process.env.NEXT_PUBLIC_HELIUS_RPC_URL ??
      "https://api.devnet.solana.com";
    getKommittersForProject(rpcUrl, projectPda)
      .then((r) => {
        if (!cancelled) setRecords(r);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectPda, records, loading]);

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="mt-8 bg-white border-[3px] border-black shadow-brutal"
    >
      <summary className="cursor-pointer px-5 py-4 flex items-center justify-between gap-3 font-epilogue font-bold uppercase tracking-widest text-[11px] hover:bg-gray-50">
        <span className="inline-flex items-center gap-2">
          <Icon name="deployed_code" size="sm" />
          On-chain cohort · via{" "}
          <span className="text-primary">@kommitapp/reader</span>
        </span>
        <Icon name="expand_more" size="sm" />
      </summary>
      <div className="px-5 pb-5">
        {loading ? (
          <p className="font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest">
            Reading on-chain…
          </p>
        ) : error ? (
          <p className="font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest">
            Couldn&rsquo;t read on-chain ({error}).
          </p>
        ) : records && records.length > 0 ? (
          <OnChainCohortTable records={records} />
        ) : (
          <p className="font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest">
            No on-chain commitments yet — the demo cohort above is local.
          </p>
        )}
      </div>
    </details>
  );
}

function OnChainCohortTable({ records }: { records: KommitRecord[] }) {
  return (
    <div className="space-y-3 mt-3">
      {records.map((r) => (
        <article
          key={r.commitmentPda}
          className="bg-white border-[3px] border-black shadow-brutal p-5 grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_auto] gap-4 items-center"
        >
          <div className="min-w-0">
            <div className="font-mono font-bold text-sm tracking-tight truncate">
              {`${r.user.slice(0, 6)}…${r.user.slice(-4)}`}
            </div>
            <div className="font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest mt-0.5">
              Backed since{" "}
              {r.depositTs > 0
                ? shortDate(new Date(r.depositTs * 1000).toISOString())
                : "—"}
            </div>
          </div>
          <div className="font-epilogue font-bold text-sm uppercase tracking-tight">
            <span className="text-gray-500">Active</span>{" "}
            <span className="font-black text-base">
              {formatUSD(Number(r.principal) / 1_000_000)}
            </span>
          </div>
          <div className="font-epilogue font-bold text-sm uppercase tracking-tight">
            <span className="text-gray-500">Lifetime</span>{" "}
            <span className="font-black text-base">
              {formatNumber(Number(r.lifetimeScore / 1_000_000n))}
            </span>
          </div>
          <span className="bg-primary text-white px-3 py-1.5 border-[2px] border-black uppercase text-xs font-epilogue font-black tracking-tight inline-flex max-w-fit">
            {formatNumber(Number(r.lifetimeScore / 1_000_000n))} kommits
          </span>
        </article>
      ))}
    </div>
  );
}

function sortKommitters(kommitters: ProjectKommitter[], key: SortKey): ProjectKommitter[] {
  const arr = kommitters.slice();
  switch (key) {
    case "kommitted":
      arr.sort((a, b) => b.kommittedUSD - a.kommittedUSD);
      break;
    case "kommits":
      arr.sort(
        (a, b) =>
          kommitsFor(b.kommittedUSD, b.sinceISO) -
          kommitsFor(a.kommittedUSD, a.sinceISO),
      );
      break;
    case "recent":
    default:
      arr.sort((a, b) => b.sinceISO.localeCompare(a.sinceISO));
      break;
  }
  return arr;
}
