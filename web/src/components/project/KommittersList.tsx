import { relativeTime } from "@/lib/date-utils";
import { kommitsFor, formatNumber, formatUSD } from "@/lib/kommit-math";
import type { ProjectKommitter } from "@/lib/data/projects";

export function KommittersList({ kommitters, limit }: { kommitters: ProjectKommitter[]; limit?: number }) {
  const items = limit ? kommitters.slice(0, limit) : kommitters;

  if (items.length === 0) {
    return (
      <div className="bg-white border-[3px] border-black shadow-brutal p-6 text-center">
        <p className="font-epilogue font-black uppercase text-base tracking-tight">
          No kommitters yet. Be the first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((k, i) => (
        <KommitterRow key={i} kommitter={k} />
      ))}
    </div>
  );
}

function KommitterRow({ kommitter }: { kommitter: ProjectKommitter }) {
  const kommits = kommitsFor(kommitter.kommittedUSD, kommitter.sinceISO);
  return (
    <div className="bg-white border-[3px] border-black shadow-brutal p-4 flex items-center gap-4 flex-wrap font-epilogue font-bold tracking-tight">
      <span className="font-epilogue font-black text-sm tracking-tight bg-gray-100 px-2 py-1 border-[2px] border-black">
        {kommitter.name}
      </span>
      <span className="text-gray-500 uppercase text-xs tracking-widest">Committed</span>
      <span className="font-black">{formatUSD(kommitter.kommittedUSD)}</span>
      <span className="text-gray-500 uppercase text-xs tracking-widest">·</span>
      <span className="text-gray-500 uppercase text-xs tracking-widest">
        {relativeTime(kommitter.sinceISO)}
      </span>
      <span className="ml-auto bg-primary text-white px-2 py-1 border-[2px] border-black uppercase text-xs">
        {formatNumber(kommits)} kommits
      </span>
    </div>
  );
}
