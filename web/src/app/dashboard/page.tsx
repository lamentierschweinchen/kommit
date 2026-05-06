import Link from "next/link";
import { AuthHeader } from "@/components/layout/AuthHeader";
import { Footer } from "@/components/layout/Footer";
import { Sidebar } from "@/components/layout/Sidebar";
import { CommitmentRow } from "@/components/dashboard/CommitmentRow";
import { RightRail } from "@/components/dashboard/RightRail";
import { ProjectCardSmall } from "@/components/project/ProjectCardSmall";
import { LUKAS_COMMITMENTS } from "@/lib/data/commitments";
import { getProject, PROJECTS } from "@/lib/data/projects";
import { kommitsFor, formatNumber, formatUSD } from "@/lib/kommit-math";
import { shortDate } from "@/lib/date-utils";

export default function DashboardPage() {
  const commitments = LUKAS_COMMITMENTS;

  const activeUSD = commitments.reduce((acc, c) => acc + c.kommittedUSD, 0);
  const lifetimeKommits = commitments.reduce(
    (acc, c) => acc + kommitsFor(c.kommittedUSD, c.sinceISO),
    0,
  );
  const earliest = commitments
    .map((c) => c.sinceISO)
    .sort()[0];

  const recommendedSlugs = ["cadence", "forge-health", "verity-books"];
  const recommended = recommendedSlugs
    .map((s) => PROJECTS.find((p) => p.slug === s))
    .filter((p): p is NonNullable<typeof p> => !!p);

  return (
    <>
      <AuthHeader />
      <div className="flex flex-1 relative">
        <Sidebar variant="kommitter" />
        <main className="flex-1 lg:ml-64 px-6 md:px-12 pb-24 max-w-[calc(80rem-16rem)] w-full">
          <section className="mt-12 md:mt-16">
            <h1 className="font-epilogue font-black uppercase text-4xl md:text-6xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit">
              Overview
            </h1>
          </section>

          <section className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
            <StatCard
              label="Active committed"
              value={formatUSD(activeUSD)}
              hint={`across ${commitments.length} projects`}
            />
            <StatCard
              label="Lifetime kommits"
              value={formatNumber(lifetimeKommits)}
              hint="non-transferable · yours forever"
              accent
            />
            <StatCard
              label="Kommitting since"
              value={earliest ? shortDate(earliest) : "—"}
              hint={earliest ? earliest.slice(0, 4) : ""}
            />
          </section>

          {/* Audit #14: two-column grid at lg+. Single column at md and below. */}
          <div className="mt-20 grid grid-cols-1 lg:grid-cols-[1fr_minmax(320px,400px)] gap-10">
            <div className="space-y-20">
              <section className="pt-10 border-t-[8px] border-black">
                <h2 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit mb-8">
                  Your commitments
                </h2>
                {commitments.length === 0 ? (
                  <div className="bg-white border-[3px] border-black shadow-brutal p-8 text-center">
                    <p className="font-epilogue font-black uppercase text-2xl tracking-tighter mb-4">
                      No commitments yet.
                    </p>
                    <Link
                      href="/projects"
                      className="inline-flex items-center gap-2 bg-primary text-white font-epilogue font-black uppercase tracking-tight text-sm px-6 py-3 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform"
                    >
                      Browse projects
                      <span className="material-symbols-outlined text-base">arrow_forward</span>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {commitments.map((c) => {
                      const project = getProject(c.projectSlug);
                      if (!project) return null;
                      return (
                        <CommitmentRow key={c.projectSlug} commitment={c} project={project} />
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="pt-10 border-t-[8px] border-black">
                <h2 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit mb-8">
                  Back more projects
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {recommended.map((p) => (
                    <ProjectCardSmall key={p.slug} project={p} />
                  ))}
                </div>
              </section>
            </div>

            <aside className="lg:pt-10 lg:border-t-[8px] lg:border-black">
              <RightRail />
            </aside>
          </div>
        </main>
      </div>
      <Footer withSidebarOffset />
    </>
  );
}

function StatCard({
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
        className={`mt-2 font-epilogue font-black text-4xl md:text-5xl tracking-tighter ${accent ? "text-primary" : ""}`}
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
