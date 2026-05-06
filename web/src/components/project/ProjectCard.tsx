import Link from "next/link";
import { type Project, projectImageUrl } from "@/lib/data/projects";
import { avatarUrl } from "@/lib/data/users";
import { formatUSD, formatNumber } from "@/lib/kommit-math";
import { shortDate } from "@/lib/date-utils";
import { cn } from "@/lib/cn";

const SECTOR_BG: Record<string, string> = {
  Climate: "bg-primary text-white",
  Fintech: "bg-white text-black",
  Bio: "bg-white text-black",
  Health: "bg-secondary text-black",
  Edu: "bg-secondary text-black",
  Consumer: "bg-primary text-white",
  "Creator tools": "bg-secondary text-black",
  Media: "bg-white text-black",
  Community: "bg-secondary text-black",
};

/**
 * Browse / featured grid card.
 * Audit fix #10: title scales `text-3xl md:text-4xl lg:text-5xl`, content-safe `px-6`,
 * wraps to 2 lines centered.
 */
export function ProjectCard({ project }: { project: Project }) {
  const founder = project.founders[0];
  const isGraduated = project.state === "graduated";
  const isJustListed = project.state === "just-listed";

  return (
    <Link href={`/projects/${project.slug}`} className="block group">
      <article
        className={cn(
          "bg-white border-[3px] border-black shadow-brutal-lg transition-shadow duration-300 h-full relative",
          "group-hover:shadow-brutal-purple",
        )}
      >
        {isJustListed ? (
          <div className="absolute -top-3 left-6 z-20">
            <span className="inline-block bg-secondary text-black font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black shadow-brutal-sm">
              Just listed
            </span>
          </div>
        ) : null}
        {isGraduated ? (
          <div className="absolute -top-3 left-6 z-20">
            <span className="inline-block bg-black text-white font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black shadow-brutal-sm">
              Graduated
            </span>
          </div>
        ) : null}

        <div className="relative h-48 bg-gray-900 border-b-[3px] border-black overflow-hidden flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={projectImageUrl(project.imageSeed, 800, 400)}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-50"
          />
          {/* Darken layer beneath the title — guarantees mix-blend-difference reads on bright/colorful photos */}
          <div className="absolute inset-0 bg-black/35" aria-hidden />
          <h3
            className={cn(
              "relative z-10 font-epilogue font-black uppercase tracking-tighter text-white text-center mix-blend-difference px-6",
              "text-3xl md:text-4xl lg:text-5xl leading-tight",
            )}
          >
            {project.name}
          </h3>
          <div
            className={cn(
              "absolute top-3 right-3 z-20 font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black shadow-brutal-sm",
              SECTOR_BG[project.sector] ?? "bg-white text-black",
            )}
          >
            {project.sector}
          </div>
        </div>
        <div className="p-6 space-y-5">
          <p className="text-lg font-bold leading-snug font-epilogue">{project.pitch}</p>
          <div className="inline-flex items-center gap-3 bg-gray-100 p-2 border-[2px] border-black shadow-brutal-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl(founder.avatarSeed, 80)}
              alt={founder.name}
              className="w-9 h-9 border-[2px] border-black object-cover grayscale"
            />
            <div className="pr-1">
              <div className="text-[10px] text-gray-600 font-bold uppercase tracking-wider">By</div>
              <div className="font-epilogue font-black text-sm uppercase tracking-tight">
                {founder.name}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-4 border-t-[3px] border-black">
            <Stat
              label={isGraduated ? "Total kommitted" : "Committed"}
              value={
                project.kommittersCount === 0 && project.totalKommittedUSD === 0 ? (
                  <span className="text-gray-300">$0</span>
                ) : (
                  formatUSD(project.totalKommittedUSD, { compact: project.totalKommittedUSD >= 10_000 })
                )
              }
            />
            <Stat
              label="Kommitters"
              value={
                project.kommittersCount === 0 ? (
                  <span className="text-gray-300">0</span>
                ) : (
                  formatNumber(project.kommittersCount)
                )
              }
            />
            <Stat
              label={isGraduated ? "Graduated" : "Active since"}
              value={shortDate(
                isGraduated && project.graduatedAtISO ? project.graduatedAtISO : project.activeSinceISO,
              )}
            />
          </div>
        </div>
      </article>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-[2px] border-black p-2 shadow-brutal-sm">
      <div className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">{label}</div>
      <div className="font-epilogue font-black text-base">{value}</div>
    </div>
  );
}
