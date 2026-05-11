import Link from "next/link";
import { type Project, projectImageUrl } from "@/lib/data/projects";
import { formatUSD, formatNumber } from "@/lib/kommit-math";
import { shortDate } from "@/lib/date-utils";
import { cn } from "@/lib/cn";
import { SECTOR_CHIP_CLASS } from "@/lib/data/sectors";

/**
 * Small variant — used in dashboard "Back more projects" recommendation grid.
 * Keep separate from <ProjectCard> for now (audit #18 — consolidation deferred).
 *
 * Tuned for ~280-380px column width (3 across in a single-column dashboard at md/lg).
 */
export function ProjectCardSmall({ project }: { project: Project }) {
  const isLaunchingSoon =
    project.state === "just-listed" && !project.recipientWallet;
  const isGraduated = project.state === "graduated";
  return (
    <Link href={`/projects/${project.slug}`} className="block group relative">
      {isLaunchingSoon ? (
        <div className="absolute -top-2 left-3 z-20">
          <span className="inline-block bg-white text-black font-epilogue font-black uppercase text-[9px] tracking-widest px-2 py-0.5 border-[2px] border-black shadow-brutal-sm">
            Launching soon
          </span>
        </div>
      ) : null}
      {isGraduated ? (
        <div className="absolute -top-2 left-3 z-20">
          <span className="inline-block bg-primary text-white font-epilogue font-black uppercase text-[9px] tracking-widest px-2 py-0.5 border-[2px] border-black shadow-brutal-sm">
            Graduated
          </span>
        </div>
      ) : null}
      <article
        className={cn(
          "bg-white border-[3px] border-black shadow-brutal h-full transition-shadow duration-300",
          "group-hover:shadow-brutal-purple",
        )}
      >
        <div className="relative h-32 bg-gray-900 border-b-[3px] border-black overflow-hidden flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={projectImageUrl(project.imageSeed, 600, 300)}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-60"
          />
          {/* Darken overlay so mix-blend-difference text reads on bright/colorful photos */}
          <div className="absolute inset-0 bg-black/30" aria-hidden />
          <h3 className="relative z-10 font-epilogue font-black uppercase text-2xl md:text-3xl text-white tracking-tighter mix-blend-difference text-center px-4 line-clamp-2 leading-tight">
            {project.name}
          </h3>
          <div
            className={cn(
              "absolute top-2 right-2 z-20 font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] shadow-brutal-sm",
              SECTOR_CHIP_CLASS,
            )}
          >
            {project.sector}
          </div>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm font-bold leading-snug font-epilogue line-clamp-2">
            {project.pitch}
          </p>
          <div className="text-[11px] text-gray-500 font-bold uppercase tracking-tight truncate">
            By {project.founders[0].name}
          </div>
          <div className="grid grid-cols-3 gap-1.5 pt-3 border-t-[3px] border-black">
            <SmallStat
              label="Committed"
              value={formatUSD(project.totalKommittedUSD, { compact: true })}
            />
            <SmallStat label="Kommitters" value={formatNumber(project.kommittersCount)} />
            <SmallStat
              label={project.recipientWallet ? "Active" : "Launches"}
              value={shortDate(project.activeSinceISO)}
            />
          </div>
        </div>
      </article>
    </Link>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="font-epilogue font-black text-xs tracking-tight truncate">{value}</div>
      <div className="text-[8px] font-bold text-gray-500 uppercase tracking-widest truncate">
        {label}
      </div>
    </div>
  );
}
