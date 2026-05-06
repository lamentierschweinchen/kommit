import Link from "next/link";
import { relativeTime } from "@/lib/date-utils";
import type { ProjectUpdate } from "@/lib/data/projects";

/**
 * Audit fix #17: under the sticky position card, show 2-3 most recent updates
 * for THIS project. Same data shape as the dashboard right-rail (#14), single-project scope.
 * Not sticky — un-sticks naturally as you scroll.
 */
export function RecentUpdatesMini({
  projectSlug,
  updates,
  limit = 3,
}: {
  projectSlug: string;
  updates: ProjectUpdate[];
  limit?: number;
}) {
  const items = updates.slice(0, limit);
  if (items.length === 0) return null;

  return (
    <div className="bg-white border-[3px] border-black shadow-brutal p-5 mt-6">
      <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest mb-3">
        Recent updates
      </div>
      <ul className="space-y-3">
        {items.map((u, i) => (
          <li key={i} className="border-t-[2px] border-black pt-3 first:border-t-0 first:pt-0">
            <div className="font-epilogue font-bold uppercase text-[10px] tracking-widest text-gray-500">
              {relativeTime(u.atISO)}
              {u.isPivot ? <span className="text-primary ml-1.5">· Pivot</span> : null}
            </div>
            <Link
              href={`/projects/${projectSlug}#updates`}
              className="block mt-1 font-epilogue font-bold tracking-tight text-sm leading-snug hover:underline line-clamp-2"
            >
              {u.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
