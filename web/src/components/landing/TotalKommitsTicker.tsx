"use client";

import { useLiveKommitsTotal } from "@/lib/hooks/useLiveKommits";
import { formatNumber } from "@/lib/kommit-math";
import type { Project } from "@/lib/data/projects";

/**
 * Above-the-fold "kommits are alive" signature on /app. Aggregates the
 * USD-hours across the displayed active projects and ticks once per second
 * via the same hook the dashboard uses for its lifetime-kommits card.
 *
 * Inputs are the public per-project totals — no synthetic cohort needed
 * because the math is linear in USD: splitting `totalKommittedUSD` into
 * 50 sub-positions doesn't change the tick rate, so one entry per project
 * is the simplest stable seed. Refreshes start from the same dollar-hour
 * baseline (the project's `activeSinceISO`), so the number doesn't drift
 * across reloads.
 */
export function TotalKommitsTicker({ projects }: { projects: Project[] }) {
  const positions = projects.map((p) => ({
    kommittedUSD: p.totalKommittedUSD,
    sinceISO: p.activeSinceISO,
  }));
  const live = useLiveKommitsTotal(positions);

  return (
    <section
      aria-label="Total kommits accruing across active projects"
      className="mt-16 md:mt-20 relative"
    >
      <div className="absolute inset-0 bg-secondary translate-x-3 translate-y-3 border-[3px] border-black -z-10" />
      <div className="bg-white border-[3px] border-black p-8 md:p-12 relative">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="inline-flex items-center gap-2 bg-primary text-white border-[2px] border-black px-3 py-1 shadow-brutal-sm">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" aria-hidden />
            <span className="font-epilogue font-black uppercase text-[10px] tracking-widest">
              Live
            </span>
          </div>
          <span className="font-epilogue font-bold uppercase text-[10px] tracking-widest text-gray-500">
            {projects.length} active project{projects.length === 1 ? "" : "s"}
          </span>
        </div>
        {/* Full digits with commas (not the compact-suffix `formatLiveKommits`).
            At this scale — hundreds of millions — the compact form rounds to
            1 decimal and a once-per-second tick of ~80 kommits is invisible.
            The full string ticks every second, which IS the point: the visual
            signature is "this number is moving". */}
        <div
          className="mt-6 font-epilogue font-black tracking-tighter text-primary tabular-nums leading-none break-words text-5xl md:text-7xl lg:text-8xl"
          aria-live="polite"
        >
          {formatNumber(Math.floor(live))}
        </div>
        <div className="mt-5 font-epilogue font-bold uppercase text-xs md:text-sm tracking-widest text-gray-700">
          kommits accruing across {projects.length} active project
          {projects.length === 1 ? "" : "s"} — right now
        </div>
      </div>
    </section>
  );
}
