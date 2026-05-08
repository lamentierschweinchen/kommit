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
import { avatarUrl } from "@/lib/data/users";
import type { Project, ProjectKommitter } from "@/lib/data/projects";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/common/Icon";
import { findProjectPda } from "@/lib/kommit";
import { PublicKey } from "@solana/web3.js";
import type { RemoteUpdate } from "@/lib/api-types";
// kommit.now is the first integrator of its own public on-chain reader.
// `@kommitapp/reader` is open-source (MIT) and `npm install`-able by any Solana
// product that wants to gate features on real conviction. The cohort surface
// below reads through `getKommittersForProject` exactly as the SDK README
// documents — no internal shortcut, no internal-only field. If you're
// reading this trying to understand the integration story, the SDK call is
// at the bottom of `OnChainCohortSection` in this file.
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

  const sortedKommitters = useMemo(() => sortKommitters(project.kommitters, sort), [project.kommitters, sort]);
  const visible = sortedKommitters.slice(0, shown);

  // Headline cohort numbers come from project-level totals (the system of record).
  // The enumerated kommitters list is a subset for display.
  const totalKommits = project.totalKommitsGenerated;
  const totalUSD = project.totalKommittedUSD;

  return (
    <>
      <AuthHeader />
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

          {/* Stat strip — 4 cards · post-C2 reframe (no money-flow metrics) */}
          <section className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
            <FounderStat
              label="Active kommitted"
              value={formatUSD(totalUSD)}
              hint={`across ${project.kommittersCount} kommitters`}
            />
            <FounderStat
              label="Kommitters"
              value={formatNumber(project.kommittersCount)}
              hint={project.kommittersCount > 0 ? "active cohort" : "—"}
            />
            <FounderStat
              label="Kommits generated"
              value={formatNumber(totalKommits)}
              hint="cohort total"
              accent
            />
            <FounderStat
              label="Active since"
              value={shortDate(project.activeSinceISO)}
              hint={project.activeSinceISO.slice(0, 4)}
            />
          </section>

          <section id="post-update" className="mt-20 pt-10 border-t-[8px] border-black">
            <h2 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit mb-8">
              Post an update
            </h2>
            {projectPda ? (
              <PostUpdateEditor
                projectPda={projectPda}
                onPosted={(u) => setPostedUpdates((cur) => [u, ...cur])}
              />
            ) : (
              <div className="bg-white border-[3px] border-black shadow-brutal p-6 max-w-3xl">
                <p className="font-epilogue font-bold uppercase text-sm tracking-tight">
                  This project isn&rsquo;t open for kommitments yet — posting is disabled until the on-chain account exists.
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
                        <p className="mt-1 text-sm font-medium text-gray-700">{u.body}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section id="kommitters" className="mt-20 pt-10 border-t-[8px] border-black">
            <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
              <h2 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit">
                Your kommitters
              </h2>
              <label className="flex items-center gap-3">
                <span className="font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest">
                  Sort
                </span>
                <BrutalSelect value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
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
                    Showing {Math.min(shown, sortedKommitters.length)} of {project.kommittersCount}
                  </p>
                  {shown < sortedKommitters.length ? (
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
          </section>

          <OnChainCohortSection projectPda={projectPda} />

          <YourCohortSection />
          </div>
          </AuthGate>
        </main>
      </div>
      <Footer withSidebarOffset />
    </>
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
        <span className="font-black text-base">{formatUSD(kommitter.kommittedUSD)}</span>
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
 * "On-chain cohort (live)" — the SDK consumer surface.
 *
 * Reads the project's full kommitter list directly from devnet via the
 * `@kommitapp/reader` open-source SDK. THIS surface is the production proof
 * that kommit.now is the first consumer of its own public reader: any
 * Solana product can `npm install @kommitapp/reader` and pull the same data
 * the same way. The call site is plain — see the `useEffect` below.
 *
 * Behavior:
 *   - In real auth mode: hits devnet RPC via the SDK and renders the cohort
 *     ranked by lifetime kommits descending (the SDK sorts internally).
 *   - In demo mode: still fires the SDK call but the persona project PDAs
 *     usually have no on-chain rows yet, so the empty state is normal. The
 *     mock-fed `#kommitters` section above is the demo storyteller; this
 *     section is the integration story.
 *   - Empty state explains the situation rather than hiding — composability
 *     is the claim, the empty cohort is just "no commits flowed yet on
 *     devnet."
 */
function OnChainCohortSection({ projectPda }: { projectPda: string | null }) {
  const [records, setRecords] = useState<KommitRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectPda) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const rpcUrl =
      process.env.NEXT_PUBLIC_HELIUS_RPC_URL ?? "https://api.devnet.solana.com";
    // ↓↓↓ The integration call. Identical to what an external integrator
    //     would write after `npm install @kommitapp/reader`. No private API,
    //     no service-role key, no internal shortcut.
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
  }, [projectPda]);

  return (
    <section
      id="on-chain-cohort"
      className="mt-20 pt-10 border-t-[8px] border-black"
    >
      <div className="flex items-end justify-between flex-wrap gap-4 mb-3">
        <h2 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit">
          On-chain cohort
        </h2>
        <span
          className="inline-flex items-center gap-2 bg-black text-white font-epilogue font-black uppercase text-[10px] tracking-widest px-2.5 py-1.5 border-[2px] border-black"
          title="Reads through @kommitapp/reader on every render — open-source, MIT, npm-installable. See the source comment in this component."
        >
          via @kommitapp/reader
        </span>
      </div>
      <p className="mb-6 font-epilogue font-medium text-sm text-gray-600 max-w-2xl">
        Live read of every kommitter on this project, fetched from devnet
        through the open-source{" "}
        <a
          href="https://github.com/lamentierschweinchen/kommit/tree/main/app/packages/kommit-reader"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 hover:text-black"
        >
          @kommitapp/reader
        </a>{" "}
        SDK. Any Solana product can `npm install` it and read the same cohort
        the same way — gating discounts, beta access, allocation priority on
        real on-chain conviction instead of token bags.
      </p>

      {!projectPda ? (
        <OnChainCohortNotice
          title="Project not yet on-chain"
          body="This project's recipient wallet hasn't been published on devnet — once it does, the cohort will flow in here automatically."
        />
      ) : loading ? (
        <OnChainCohortNotice
          title="Reading devnet…"
          body={`Calling getKommittersForProject(rpcUrl, "${projectPda.slice(0, 8)}…${projectPda.slice(-4)}")`}
        />
      ) : error ? (
        <OnChainCohortNotice
          title="Read failed"
          body={`SDK error: ${error}. Empty cohort doesn't crash — the SDK returns Promise<KommitRecord[]>; this is a hard error.`}
          tone="warn"
        />
      ) : records && records.length > 0 ? (
        <OnChainCohortTable records={records} />
      ) : (
        <OnChainCohortNotice
          title="No on-chain kommits yet"
          body={`The SDK returned an empty array. Cohort populates as commits flow in on devnet (program ${"GxM3sxMp4FyrkHK4g1DaDrmwYLrwd2BJKxqKZqvGgkc3".slice(0, 8)}…). The seed cohort above is mock data for demo purposes; this section is the real reader.`}
        />
      )}
    </section>
  );
}

function OnChainCohortNotice({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone?: "warn";
}) {
  return (
    <div
      className={cn(
        "border-[3px] border-black p-6 max-w-3xl",
        tone === "warn" ? "bg-secondary" : "bg-white",
      )}
    >
      <h3 className="font-epilogue font-black uppercase text-base md:text-lg tracking-tight">
        {title}
      </h3>
      <p className="mt-2 font-medium text-sm text-gray-700 leading-relaxed">
        {body}
      </p>
    </div>
  );
}

function OnChainCohortTable({ records }: { records: KommitRecord[] }) {
  return (
    <div className="space-y-3">
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

/**
 * "Your cohort" — placeholder section for founder-side v1 tools that aren't
 * shipped yet. Disabled CTAs with "Coming v1" tags so founders can see the
 * direction without confusing the surface for live functionality. Mirrors the
 * kommitter-side `<RoadmapCard>` on the public project page.
 */
function YourCohortSection() {
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
    <section id="your-cohort" className="mt-20 pt-10 border-t-[8px] border-black">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-2">
        <h2 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit">
          Your cohort
        </h2>
      </div>
      <p className="mb-8 font-epilogue font-medium text-sm text-gray-600 max-w-xl">
        What you&rsquo;ll be able to do with your kommitters as Kommit ships v1. Not live yet — these are the surfaces on the runway.
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

function sortKommitters(kommitters: ProjectKommitter[], key: SortKey): ProjectKommitter[] {
  const arr = kommitters.slice();
  switch (key) {
    case "kommitted":
      arr.sort((a, b) => b.kommittedUSD - a.kommittedUSD);
      break;
    case "kommits":
      arr.sort(
        (a, b) =>
          kommitsFor(b.kommittedUSD, b.sinceISO) - kommitsFor(a.kommittedUSD, a.sinceISO),
      );
      break;
    case "recent":
    default:
      arr.sort((a, b) => b.sinceISO.localeCompare(a.sinceISO));
      break;
  }
  return arr;
}
