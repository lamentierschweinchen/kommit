import { notFound } from "next/navigation";
import Link from "next/link";
import { AuthHeader } from "@/components/layout/AuthHeader";
import { Footer } from "@/components/layout/Footer";
import { UpdatesPanel } from "@/components/project/UpdatesPanel";
import { BackerNotes } from "@/components/project/BackerNotes";
import { findProjectPda } from "@/lib/kommit";
import { PublicKey } from "@solana/web3.js";
import { KommittersList } from "@/components/project/KommittersList";
import { UserPositionCard } from "@/components/project/UserPositionCard";
import { RoadmapCard } from "@/components/project/RoadmapCard";
import { RoadmapPanel } from "@/components/project/RoadmapPanel";
import { getProject, projectImageUrl, type Project } from "@/lib/data/projects";
import { avatarUrl } from "@/lib/data/users";
import { formatUSD, formatNumber } from "@/lib/kommit-math";
import { longDate, shortDate } from "@/lib/date-utils";
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
        {project.state === "graduated" ? <GraduatedBanner project={project} /> : null}

        <ProjectHero project={project} />

        <div className="mt-24 grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-10 lg:gap-14">
          <div className="space-y-20">
            {project.state === "graduated" && project.roadmap?.length ? (
              <ProjectRoadmapSection milestones={project.roadmap} />
            ) : null}

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

            {project.state === "graduated" && project.kommitterBenefits?.length ? (
              <KommitterBenefitsSection project={project} />
            ) : null}

            <ProjectInfoSection project={project} />

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
                    <div className="space-y-2 min-w-0">
                      <div className="font-epilogue font-black uppercase text-xl tracking-tight">
                        {f.name}
                      </div>
                      <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest">
                        {f.role}
                      </div>
                      <p className="text-sm font-medium text-gray-800 leading-relaxed">{f.bio}</p>
                      <FounderSocials socials={f.socials} name={f.name} />
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <BackerNotes projectSlug={project.slug} />

            {project.state !== "graduated" && project.roadmap?.length ? (
              <ProjectRoadmapSection milestones={project.roadmap} />
            ) : null}

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
              <KommittersList kommitters={project.kommitters} projectSlug={project.slug} limit={7} />
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
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}

function ProjectRoadmapSection({
  milestones,
}: {
  milestones: NonNullable<Project["roadmap"]>;
}) {
  return (
    <section id="roadmap">
      <h2 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit mb-8">
        Roadmap
      </h2>
      <RoadmapPanel milestones={milestones} />
    </section>
  );
}

function GraduatedBanner({ project }: { project: Project }) {
  const raised = project.raisedAmountUSD;
  const valuation = project.raisedAtValuationUSD;
  const dateISO = project.graduatedAtISO;
  return (
    <section className="mt-8 md:mt-10 relative">
      {/* Offset shadow plate gives the banner the same brutalist depth as the
          hero CTA on the landing page. */}
      <div className="absolute inset-0 bg-black translate-x-3 translate-y-3 -z-10" aria-hidden />
      <div className="bg-primary text-white border-[3px] border-black p-6 md:p-8 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 md:gap-8 items-end">
        <div>
          <div className="inline-block bg-white text-primary font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black shadow-brutal-sm mb-4">
            Graduated
          </div>
          <h2 className="font-epilogue font-black uppercase text-3xl md:text-5xl tracking-tighter leading-[0.95]">
            Round closed.
          </h2>
          <p className="mt-3 max-w-xl text-base md:text-lg font-medium text-white/90 leading-snug">
            {project.name} closed its seed extension on{" "}
            <span className="font-bold">{dateISO ? longDate(dateISO) : "graduation"}</span>.
            Kommitters earned the rights listed below.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:gap-4 md:min-w-[20rem]">
          <BannerStat
            label="Raised"
            value={raised ? formatUSD(raised, { compact: true }) : "—"}
          />
          <BannerStat
            label="At valuation"
            value={valuation ? formatUSD(valuation, { compact: true }) : "—"}
          />
        </div>
      </div>
    </section>
  );
}

function BannerStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white text-black border-[3px] border-black p-3 shadow-brutal-sm">
      <div className="font-epilogue font-bold uppercase text-[10px] text-gray-600 tracking-widest">
        {label}
      </div>
      <div className="mt-1 font-epilogue font-black text-2xl md:text-3xl tracking-tighter">
        {value}
      </div>
    </div>
  );
}

function KommitterBenefitsSection({ project }: { project: Project }) {
  const benefits = project.kommitterBenefits ?? [];
  return (
    <section>
      <h2 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit mb-8">
        What kommitters get
      </h2>
      <ol className="space-y-3 max-w-2xl">
        {benefits.map((b, i) => (
          <li
            key={i}
            className="bg-white border-[3px] border-black shadow-brutal p-4 md:p-5 flex items-start gap-4"
          >
            <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 bg-primary text-white font-epilogue font-black text-base border-[2px] border-black shadow-brutal-sm">
              {String(i + 1).padStart(2, "0")}
            </span>
            <p className="text-base md:text-lg font-medium leading-snug pt-1">{b}</p>
          </li>
        ))}
      </ol>
      <p className="mt-4 font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest max-w-2xl">
        Reserved for every kommitter active at graduation. Visit your dashboard to claim.
      </p>
    </section>
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
          {project.state === "graduated" ? (
            <span className="inline-block bg-primary text-white font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black shadow-brutal-sm">
              Graduated
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

        {/* Hero stat strip — public-facing summary. Pre-launch projects
            (no recipientWallet) reframe "Active since" as "Launch date"
            so the date doesn't read as a past timestamp on a project that
            hasn't opened for kommitments yet (handoff 58 #6). */}
        <div className="grid grid-cols-3 gap-2 max-w-md">
          <HeroStat label="Total kommitted" value={formatUSD(project.totalKommittedUSD, { compact: project.totalKommittedUSD >= 10_000 })} />
          <HeroStat label="Kommitters" value={formatNumber(project.kommittersCount)} />
          <HeroStat
            label={project.recipientWallet ? "Active since" : "Launch date"}
            value={shortDate(project.activeSinceISO)}
          />
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

function ProjectInfoSection({ project }: { project: Project }) {
  // Surfaces project-shape fields the page didn't render before — chiefly
  // `totalKommitsGenerated` (cohort score). Plus a one-glance summary of the
  // existing metadata so kommitters get a "is this real" panel before diving
  // into the team/updates.
  // Pre-launch projects (no recipientWallet) get a "Launching" stage label
  // and reframe "Active since" → "Launching on" so the date reads as a
  // forward-looking promise instead of a past timestamp (handoff 58 #6).
  const isPreLaunch = !project.recipientWallet;
  const stateLabel = isPreLaunch
    ? "Launching"
    : project.state === "graduated"
      ? "Graduated"
      : project.state === "just-listed"
        ? "Just listed"
        : "Active";
  const lastUpdate = [...project.updates].sort((a, b) => b.atISO.localeCompare(a.atISO))[0];
  const cohortKommits = project.totalKommitsGenerated;
  const items: Array<{ label: string; value: string }> = [
    { label: "Sector", value: project.sector },
    { label: "Stage", value: stateLabel },
    {
      label: isPreLaunch ? "Launching on" : "Active since",
      value: longDate(project.activeSinceISO),
    },
    {
      label: "Cohort kommits",
      value: cohortKommits > 0 ? formatNumber(cohortKommits) : "—",
    },
    {
      label: "Total committed",
      value: formatUSD(project.totalKommittedUSD, {
        compact: project.totalKommittedUSD >= 10_000,
      }),
    },
    { label: "Kommitters", value: formatNumber(project.kommittersCount) },
  ];
  return (
    <section>
      <h2 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit mb-8">
        Project info
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {items.map((it) => (
          <div key={it.label} className="bg-white border-[3px] border-black p-4 shadow-brutal-sm">
            <div className="font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest">
              {it.label}
            </div>
            <div className="mt-1 font-epilogue font-black text-base md:text-lg tracking-tight">
              {it.value}
            </div>
          </div>
        ))}
      </div>
      {lastUpdate ? (
        <p className="mt-4 font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest">
          Last update {shortDate(lastUpdate.atISO)} — {lastUpdate.title}
        </p>
      ) : null}
    </section>
  );
}

function FounderSocials({
  socials,
  name,
}: {
  socials?: { linkedin?: string; twitter?: string; website?: string };
  name: string;
}) {
  if (!socials) return null;
  type Entry = { url: string; key: "linkedin" | "twitter" | "website"; label: string; svg: React.ReactNode };
  const entries: Entry[] = [];
  if (socials.linkedin) {
    entries.push({
      url: socials.linkedin,
      key: "linkedin",
      label: "LinkedIn",
      // lucide-react dropped brand glyphs, so brand icons live as inline SVGs.
      svg: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden>
          <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
        </svg>
      ),
    });
  }
  if (socials.twitter) {
    entries.push({
      url: socials.twitter,
      key: "twitter",
      label: "Twitter",
      svg: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    });
  }
  if (socials.website) {
    entries.push({
      url: socials.website,
      key: "website",
      label: "Website",
      svg: <Icon name="globe" size="sm" />,
    });
  }
  if (entries.length === 0) return null;
  return (
    <div className="pt-2 flex items-center gap-2">
      {entries.map((e) => (
        <Link
          key={e.key}
          href={e.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${name} on ${e.label}`}
          className="w-8 h-8 border-[2px] border-black bg-white shadow-brutal-sm flex items-center justify-center hover:bg-secondary hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform"
        >
          {e.svg}
        </Link>
      ))}
    </div>
  );
}
