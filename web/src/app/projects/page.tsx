"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { AuthHeader } from "@/components/layout/AuthHeader";
import { Footer } from "@/components/layout/Footer";
import { ProjectCard } from "@/components/project/ProjectCard";
import {
  BrowseToolbar,
  type BrowseFilters,
} from "@/components/project/BrowseToolbar";
import { Icon } from "@/components/common/Icon";
import { useFilteredProjects } from "@/lib/hooks/useFilteredProjects";
import { PROJECTS } from "@/lib/data/projects";
import { formatNumber, formatUSD } from "@/lib/kommit-math";

const initialFilters: BrowseFilters = {
  sectors: [],
  stages: [],
  query: "",
  sort: "recent",
};

export default function BrowsePage() {
  const [filters, setFilters] = useState<BrowseFilters>(initialFilters);
  const filtered = useFilteredProjects(filters);

  const totals = useMemo(() => {
    const usd = PROJECTS.reduce((acc, p) => acc + p.totalKommittedUSD, 0);
    const kommitters = PROJECTS.reduce((acc, p) => acc + p.kommittersCount, 0);
    const justListed = PROJECTS.filter((p) => p.state === "just-listed").length;
    return { usd, kommitters, justListed };
  }, []);

  const isFiltered =
    filters.sectors.length > 0 || filters.stages.length > 0 || filters.query.trim().length > 0;

  return (
    <>
      <AuthHeader />
      <main className="flex-1 px-6 md:px-12 pb-24 max-w-7xl mx-auto w-full">
        <section className="mt-12 md:mt-16">
          <div className="flex items-end justify-between flex-wrap gap-4">
            <h1 className="font-epilogue font-black uppercase text-4xl md:text-6xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit">
              Active projects
            </h1>
            <div className="font-epilogue font-bold uppercase text-sm text-gray-500 tracking-widest">
              {isFiltered ? (
                <>
                  Showing {filtered.length} of {PROJECTS.length}
                </>
              ) : (
                <>
                  {PROJECTS.length} projects · {formatUSD(totals.usd, { compact: true })} committed ·{" "}
                  {formatNumber(totals.kommitters)} kommitters total
                  {totals.justListed > 0 ? ` · ${totals.justListed} just listed` : ""}
                </>
              )}
            </div>
          </div>
        </section>

        <section className="mt-10">
          <BrowseToolbar filters={filters} onChange={setFilters} />
        </section>

        <section className="mt-10">
          {filtered.length === 0 ? (
            <div className="bg-white border-[3px] border-black shadow-brutal-lg p-10 md:p-16 text-center max-w-2xl mx-auto">
              <h2 className="font-epilogue font-black uppercase text-3xl md:text-4xl tracking-tighter">
                No projects match these filters.
              </h2>
              <button
                type="button"
                onClick={() => setFilters(initialFilters)}
                className="mt-8 inline-flex items-center gap-2 bg-primary text-white font-epilogue font-black uppercase tracking-tight text-sm px-6 py-3 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
              >
                Clear filters
                <Icon name="arrow_forward" size="sm" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {filtered.map((p) => (
                <ProjectCard key={p.slug} project={p} />
              ))}
            </div>
          )}
        </section>

        {filtered.length > 0 ? (
          <section className="mt-16 flex items-center justify-between flex-wrap gap-4">
            <Link
              href="/"
              className="bg-white text-black font-epilogue font-black uppercase tracking-tight text-sm px-6 py-3 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform flex items-center gap-2"
            >
              <Icon name="arrow_back" />
              Home
            </Link>
            <div className="font-epilogue font-bold uppercase text-xs tracking-widest text-gray-500">
              Showing all {filtered.length}
            </div>
          </section>
        ) : null}
      </main>
      <Footer />
    </>
  );
}
