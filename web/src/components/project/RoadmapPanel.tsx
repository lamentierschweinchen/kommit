import { longDate } from "@/lib/date-utils";
import { cn } from "@/lib/cn";
import type { RoadmapMilestone } from "@/lib/data/projects";

/**
 * Project-specific roadmap panel. Vertical stacked-card layout (option B
 * per handoff 66): oldest milestone at top, newest at the bottom — reads
 * as a forward-looking timeline. Cards carry date + title + state pill
 * only; no body copy. The IN PROGRESS milestone gets the purple shadow
 * so the "where we are now" beat pops on the page.
 */
export function RoadmapPanel({ milestones }: { milestones: RoadmapMilestone[] }) {
  if (!milestones.length) return null;
  // Defensive sort — seed data is already chronological, but we don't want
  // a misordered entry to silently flip the narrative.
  const sorted = [...milestones].sort((a, b) => a.atISO.localeCompare(b.atISO));
  return (
    <ol className="space-y-4">
      {sorted.map((m, i) => (
        <RoadmapRow key={`${m.atISO}-${i}`} milestone={m} />
      ))}
    </ol>
  );
}

function RoadmapRow({ milestone }: { milestone: RoadmapMilestone }) {
  const isInProgress = milestone.status === "in-progress";
  return (
    <li
      className={cn(
        "bg-white border-[3px] border-black p-5 md:p-6",
        isInProgress ? "shadow-brutal-purple" : "shadow-brutal-sm",
      )}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <span className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest">
          {longDate(milestone.atISO)}
        </span>
        <StatePill status={milestone.status} />
      </div>
      <h3 className="mt-2 font-epilogue font-black uppercase text-lg md:text-xl tracking-tight leading-tight">
        {milestone.title}
      </h3>
    </li>
  );
}

function StatePill({ status }: { status: RoadmapMilestone["status"] }) {
  if (status === "done") {
    return (
      <span className="inline-block bg-primary text-white font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black shadow-brutal-sm">
        Done
      </span>
    );
  }
  if (status === "in-progress") {
    return (
      <span className="inline-block bg-secondary text-black font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black shadow-brutal-sm">
        In progress
      </span>
    );
  }
  return (
    <span className="inline-block bg-white text-gray-600 font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-gray-400 shadow-brutal-sm">
      Upcoming
    </span>
  );
}
