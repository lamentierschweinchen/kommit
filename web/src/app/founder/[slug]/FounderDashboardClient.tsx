"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AuthHeader } from "@/components/layout/AuthHeader";
import { Footer } from "@/components/layout/Footer";
import { Sidebar } from "@/components/layout/Sidebar";
import { BrutalSelect } from "@/components/common/BrutalSelect";
import { PostUpdateEditor, type PendingUpdate } from "@/components/founder/PostUpdateEditor";
import { kommitsFor, formatNumber, formatUSD } from "@/lib/kommit-math";
import { shortDate, daysBetween } from "@/lib/date-utils";
import { avatarUrl } from "@/lib/data/users";
import type { Project, ProjectKommitter } from "@/lib/data/projects";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/common/Icon";

type SortKey = "recent" | "kommitted" | "kommits";

const PAGE_SIZE = 7;

export function FounderDashboardClient({ project }: { project: Project }) {
  const [pendingUpdates, setPendingUpdates] = useState<PendingUpdate[]>([]);
  const [sort, setSort] = useState<SortKey>("recent");
  const [shown, setShown] = useState(PAGE_SIZE);

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
        <main className="flex-1 lg:ml-64 px-6 md:px-12 pb-24 max-w-[calc(80rem-16rem)] w-full">
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
            <PostUpdateEditor onPosted={(u) => setPendingUpdates((cur) => [u, ...cur])} />

            {pendingUpdates.length > 0 ? (
              <div className="mt-8 max-w-3xl">
                <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest mb-3">
                  Just posted (in-memory · this session only)
                </div>
                <ul className="space-y-3">
                  {pendingUpdates.map((u, i) => (
                    <li
                      key={i}
                      className={cn(
                        "bg-white border-[3px] border-black p-4",
                        u.isPivot ? "shadow-brutal-purple" : "shadow-brutal",
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest">
                          {u.atISO}
                        </span>
                        {u.isPivot ? (
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
