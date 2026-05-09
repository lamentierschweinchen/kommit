import { notFound } from "next/navigation";
import Link from "next/link";
import { AuthHeader } from "@/components/layout/AuthHeader";
import { Footer } from "@/components/layout/Footer";
import { UpdatesPanel } from "@/components/project/UpdatesPanel";
import { findProjectPda } from "@/lib/kommit";
import { PublicKey } from "@solana/web3.js";
import { KommittersList } from "@/components/project/KommittersList";
import { UserPositionCard } from "@/components/project/UserPositionCard";
import { RecentUpdatesMini } from "@/components/project/RecentUpdatesMini";
import { RoadmapCard } from "@/components/project/RoadmapCard";
import { getProject, projectImageUrl, type Project } from "@/lib/data/projects";
import { avatarUrl } from "@/lib/data/users";
import { formatUSD, formatNumber } from "@/lib/kommit-math";
import { shortDate } from "@/lib/date-utils";
import { cn } from "@/lib/cn";
import { Tape } from "@/components/common/Tape";
import { Icon } from "@/components/common/Icon";
import { SECTOR_CHIP_CLASS } from "@/lib/data/sectors";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  let projectPda: string | null = null;
  if (project.recipientWallet) {
    try {
      projectPda = findProjectPda(new PublicKey(project.recipientWallet)).toBase58();
    } catch {
      projectPda = null;
    }
  }

  return (
    <>
      <AuthHeader homeHref="/app" />
      <main className="flex-1 px-6 md:px-12 pb-24 max-w-7xl mx-auto w-full">
        <ProjectHero project={project} />

        <div className="mt-24 grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-10 lg:gap-14">
          <div className="space-y-20">
            <section>
              <h2 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit mb-8">
                The pitch
              </h2>
              <div className="space-y-5 text-base md:text-lg font-medium text-gray-800 leading-relaxed max-w-2xl">
                {project.longerPitch.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>

            <section>
              <h2 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit mb-8">
                The team
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {project.founders.map((f) => (
                  <article
                    key={f.name}
                    className="bg-white border-[3px] border-black shadow-brutal p-6 flex gap-5"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={avatarUrl(f.avatarSeed, 200)}
                      alt={f.name}
                      className="w-24 h-24 border-[3px] border-black object-cover grayscale shrink-0"
                    />
                    <div className="space-y-2">
                      <div className="font-epilogue font-black uppercase text-xl tracking-tight">
                        {f.name}
                      </div>
                      <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest">
                        {f.role}
                      </div>
                      <p className="text-sm font-medium text-gray-800 leading-relaxed">{f.bio}</p>
                      {f.pastWorkUrl ? (
                        <Link
                          href={f.pastWorkUrl}
                          className="inline-flex items-center gap-1 font-epilogue font-bold uppercase tracking-widest text-[11px] text-primary hover:underline"
                        >
                          Past work
                          <Icon name="arrow_outward" size="xs" />
                        </Link>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section id="updates">
              <h2 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit mb-8">
                Updates
              </h2>
              <UpdatesPanel
                projectPda={projectPda}
                projectSlug={project.slug}
                fallback={project.updates}
              />
            </section>

            <section>
              <h2 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit mb-8">
                Recent kommitters
              </h2>
              <KommittersList kommitters={project.kommitters} limit={7} />
              {project.kommitters.length > 7 ? (
                <p className="mt-6 font-epilogue font-bold uppercase text-xs tracking-widest text-gray-500">
                  Showing 7 of {project.kommittersCount}
                </p>
              ) : null}
            </section>

            <section>
              <h2 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit mb-8">
                What&rsquo;s next
              </h2>
              <RoadmapCard />
            </section>
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <UserPositionCard project={project} />
            <RecentUpdatesMini
              projectSlug={project.slug}
              projectPda={projectPda}
              updates={project.updates}
            />
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}

function ProjectHero({ project }: { project: Project }) {
  return (
    <section className="mt-12 md:mt-16 grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-10 items-center">
      <div className="space-y-6">
        {/* Pass-2 P1 #17: breadcrumb row carries ONLY the back-link. The
            sector + state chips were collapsed three unrelated patterns into
            one row (back-link · breadcrumb-separator · category-tag). They now
            live as a metadata strip between the H1 and the pitch — clearly
            project-context, not navigation. */}
        <Link
          href="/projects"
          className="font-epilogue font-bold uppercase tracking-widest text-xs text-gray-500 hover:text-black inline-flex items-center gap-1"
        >
          <Icon name="arrow_back" size="sm" />
          Back to projects
        </Link>
        <h1 className="font-epilogue font-black uppercase text-5xl sm:text-6xl md:text-7xl lg:text-8xl tracking-tighter leading-[0.95] -rotate-1">
          {project.name}
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              "inline-block font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] shadow-brutal-sm",
              SECTOR_CHIP_CLASS,
            )}
          >
            {project.sector}
          </span>
          {project.state === "just-listed" && project.recipientWallet ? (
            <span className="inline-block bg-secondary text-black font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black shadow-brutal-sm">
              Just listed
            </span>
          ) : null}
          {project.state === "just-listed" && !project.recipientWallet ? (
            <span className="inline-block bg-white text-black font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black shadow-brutal-sm">
              Launching soon
            </span>
          ) : null}
        </div>
        <p className="text-xl md:text-2xl font-medium text-gray-800 leading-snug border-l-[4px] border-primary pl-5">
          {project.pitch}
        </p>
        <div className="inline-flex items-center gap-3 bg-gray-100 p-3 border-[3px] border-black shadow-brutal max-w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarUrl(project.founders[0].avatarSeed, 120)}
            alt={project.founders[0].name}
            className="w-12 h-12 border-[3px] border-black object-cover grayscale"
          />
          <div className="pr-2">
            <div className="text-[10px] text-gray-600 font-bold uppercase tracking-wider">By</div>
            <div className="font-epilogue font-black text-base uppercase tracking-tight">
              {project.founders[0].name}
            </div>
          </div>
        </div>
        {project.updates.find((u) => u.isPivot) ? (
          <Tape color="primary" size="md" rotation={-3} className="hidden" />
        ) : null}

        {/* Hero stat strip — public-facing summary */}
        <div className="grid grid-cols-3 gap-2 max-w-md">
          <HeroStat label="Total kommitted" value={formatUSD(project.totalKommittedUSD, { compact: project.totalKommittedUSD >= 10_000 })} />
          <HeroStat label="Kommitters" value={formatNumber(project.kommittersCount)} />
          <HeroStat label="Active since" value={shortDate(project.activeSinceISO)} />
        </div>
      </div>
      <div className="relative">
        {/* Audit #15: drop the in-image text on hero. The H1 carries the title; corner accents stay. */}
        <div className="aspect-square bg-gray-900 border-[3px] border-black shadow-brutal-lg relative overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={projectImageUrl(`${project.imageSeed}-hero`, 800, 800)}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-60"
          />
          <div className="absolute top-3 left-3 w-12 h-1 bg-secondary" />
          <div className="absolute top-3 left-3 w-1 h-12 bg-secondary" />
          <div className="absolute bottom-3 right-3 w-12 h-1 bg-primary" />
          <div className="absolute bottom-3 right-3 w-1 h-12 bg-primary" />
        </div>
      </div>
    </section>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-[3px] border-black p-3 shadow-brutal-sm bg-white">
      <div className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">{label}</div>
      <div className="font-epilogue font-black text-base">{value}</div>
    </div>
  );
}
