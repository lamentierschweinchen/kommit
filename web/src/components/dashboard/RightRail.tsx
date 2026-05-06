"use client";

import Link from "next/link";
import { relativeTime } from "@/lib/date-utils";
import type { Commitment } from "@/lib/data/commitments";
import { PROJECTS, type Project, type ProjectUpdate } from "@/lib/data/projects";

/**
 * Audit fix #14: right-rail "Recent updates from your projects".
 * Pulls latest founder updates from projects the user backs.
 * Each row: small project logo + name + update headline (truncated 1-2 lines) + relative time.
 *
 * Also houses Round invites + Pivot alerts (moved from full-width sections).
 */
export function RightRail({ commitments }: { commitments: Commitment[] }) {
  // Build a flat list of [project, update] pairs from backed projects, sort by recency.
  const backed = commitments
    .map((c) => PROJECTS.find((p) => p.slug === c.projectSlug))
    .filter((p): p is Project => !!p);

  const updates: { project: Project; update: ProjectUpdate }[] = [];
  for (const p of backed) {
    for (const u of p.updates) {
      updates.push({ project: p, update: u });
    }
  }
  updates.sort((a, b) => b.update.atISO.localeCompare(a.update.atISO));
  const recent = updates.slice(0, 6);

  // Pivot alerts — projects in user's portfolio that pivoted recently.
  const pivotAlerts = backed
    .map((p) => ({ project: p, pivot: p.updates.find((u) => u.isPivot) }))
    .filter((x) => x.pivot)
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <Section title="Recent updates">
        {recent.length === 0 ? (
          <p className="text-sm text-gray-500 leading-relaxed font-medium">
            Nothing yet — back a project to see what they&rsquo;re shipping.
          </p>
        ) : (
          <ul className="space-y-4">
            {recent.map(({ project, update }, i) => (
              <li key={i} className="border-t-[2px] border-black pt-4 first:border-t-0 first:pt-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-epilogue font-black uppercase text-[10px] tracking-widest">
                    {project.name}
                  </span>
                  <span className="text-gray-400 text-[10px]">·</span>
                  <span className="font-epilogue font-bold uppercase text-[10px] tracking-widest text-gray-500">
                    {relativeTime(update.atISO)}
                  </span>
                  {update.isPivot ? (
                    <span className="ml-auto bg-primary text-white px-1.5 py-0.5 border-[2px] border-black uppercase text-[9px] font-epilogue font-black tracking-widest">
                      Pivot
                    </span>
                  ) : null}
                </div>
                <Link
                  href={`/projects/${project.slug}#updates`}
                  className="block font-epilogue font-bold tracking-tight text-sm leading-snug hover:underline line-clamp-2"
                >
                  {update.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {pivotAlerts.length > 0 ? (
        <Section title="Pivot alerts">
          <ul className="space-y-4">
            {pivotAlerts.map(({ project, pivot }, i) => (
              <li key={i} className="border-t-[2px] border-black pt-4 first:border-t-0 first:pt-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-primary text-white px-1.5 py-0.5 border-[2px] border-black uppercase text-[9px] font-epilogue font-black tracking-widest">
                    Pivot
                  </span>
                  <span className="font-epilogue font-bold uppercase text-[10px] tracking-widest text-gray-500">
                    {project.name}
                  </span>
                </div>
                <Link
                  href={`/projects/${project.slug}#updates`}
                  className="block font-epilogue font-bold tracking-tight text-sm leading-snug hover:underline line-clamp-2"
                >
                  {pivot!.title}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border-[3px] border-black shadow-brutal p-5">
      <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest mb-3">
        {title}
      </div>
      {children}
    </section>
  );
}
