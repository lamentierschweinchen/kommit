import { longDate } from "@/lib/date-utils";
import { cn } from "@/lib/cn";
import type { ProjectUpdate } from "@/lib/data/projects";

export function UpdatesList({ updates }: { updates: ProjectUpdate[] }) {
  return (
    <div className="space-y-5">
      {updates.map((u, i) => (
        <UpdateRow key={i} update={u} />
      ))}
    </div>
  );
}

function UpdateRow({ update }: { update: ProjectUpdate }) {
  return (
    <article
      className={cn(
        "bg-white border-[3px] border-black p-6",
        update.isPivot ? "shadow-brutal-purple" : "shadow-brutal",
      )}
    >
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <span className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest">
          {longDate(update.atISO)}
        </span>
        {update.isPivot ? (
          <span className="inline-block bg-primary text-white font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black shadow-brutal-sm">
            Pivot
          </span>
        ) : null}
        {update.isGraduation ? (
          <span className="inline-block bg-secondary text-black font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black shadow-brutal-sm">
            Graduation
          </span>
        ) : null}
      </div>
      <h3 className="font-epilogue font-black uppercase text-lg md:text-xl tracking-tight mb-2">
        {update.title}
      </h3>
      <p className="text-base font-medium text-gray-800 leading-relaxed whitespace-pre-line">
        {update.body}
      </p>
    </article>
  );
}
