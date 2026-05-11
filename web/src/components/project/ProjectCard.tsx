import Link from "next/link";
import { type Project, projectImageUrl } from "@/lib/data/projects";
import { avatarUrl } from "@/lib/data/users";
import { formatUSD, formatNumber } from "@/lib/kommit-math";
import { shortDate } from "@/lib/date-utils";
import { cn } from "@/lib/cn";
import { SECTOR_CHIP_CLASS } from "@/lib/data/sectors";

/**
 * Browse / featured grid card.
 * Audit fix #10: title scales `text-3xl md:text-4xl lg:text-5xl`, content-safe `px-6`,
 * wraps to 2 lines centered.
 */
export function ProjectCard({ project }: { project: Project }) {
  const founder = project.founders[0];
  const isGraduated = project.state === "graduated";
  // High #5: a project whose state is "just-listed" but whose on-chain Project
  // account doesn't exist yet (no recipientWallet) is structurally not open
  // for kommitments. Render "Opening soon" so the badge doesn't contradict the
  // commit-modal gate.
  const isJustListedAndOpen = project.state === "just-listed" && !!project.recipientWallet;
  const isOpeningSoon = project.state === "just-listed" && !project.recipientWallet;

  return (
    <Link href={`/projects/${project.slug}`} className="block group">
      <article
        className={cn(
          "bg-white border-[3px] border-black shadow-brutal-lg transition-shadow duration-300 h-full relative",
          "group-hover:shadow-brutal-purple",
        )}
      >
        {isJustListedAndOpen ? (
          <div className="absolute -top-3 left-6 z-20">
            <span className="inline-block bg-secondary text-black font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black shadow-brutal-sm">
              Just listed
            </span>
          </div>
        ) : null}
        {isOpeningSoon ? (
          <div className="absolute -top-3 left-6 z-20">
            <span className="inline-block bg-white text-black font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black shadow-brutal-sm">
              Launching soon
            </span>
          </div>
        ) : null}
        {isGraduated ? (
          <div className="absolute -top-3 left-6 z-20">
            <span className="inline-block bg-primary text-white font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black shadow-brutal-sm">
              Graduated
            </span>
          </div>
        ) : null}

        <div className="relative h-48 bg-gray-900 border-b-[3px] border-black overflow-hidden flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={projectImageUrl(project.imageSeed, 800, 400)}
            alt=""
            draggable={false}
            // Pass-2 P1 #9: raise image opacity so the imagery has rhythm / colour
            // across the row instead of reading as greyscale filler.
            className="absolute inset-0 w-full h-full object-cover opacity-80 pointer-events-none select-none"
          />
          {/* Pass-2 P1 #9: lighten the darken layer so titles read at full
              white-on-content contrast without muddying every photo into grey.
              Pass-2 P1 #8: pointer-events-none so this overlay doesn't swallow clicks meant for the parent <Link>. */}
          <div className="absolute inset-0 bg-black/25 pointer-events-none" aria-hidden />
          <h3
            className={cn(
              // Pass-2 P1 #9: drop mix-blend-difference (was rendering as pale
              // grey on mid-tone photos). Solid white + drop shadow guarantees
              // the title reads at full contrast regardless of the photo behind.
              "relative z-10 font-epilogue font-black uppercase tracking-tighter text-white text-center px-6 pointer-events-none",
              "[text-shadow:_0_2px_8px_rgba(0,0,0,0.6)]",
              "text-3xl md:text-4xl lg:text-5xl leading-tight",
            )}
          >
            {project.name}
          </h3>
          <div
            className={cn(
              "absolute top-3 right-3 z-20 font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] shadow-brutal-sm",
              SECTOR_CHIP_CLASS,
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
              label={
                isGraduated
                  ? "Graduated"
                  : isOpeningSoon
                    ? "Launching"
                    : "Active since"
              }
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
