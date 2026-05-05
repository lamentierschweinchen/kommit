/**
 * Founder-dashboard list of supporters per design.md wireframe.
 * Sortable by recency / amount / points (sort UI deferred to v1.5).
 *
 * Points are u128 from Anchor / Supabase — formatted via lib/money.formatScore
 * for exact display past 2^53.
 */

import { formatScore } from "@/lib/money";
import type { Supporter } from "@/lib/mock-data";

const fmt = (n: number) => n.toLocaleString("en-US");

export function CommitterList({ supporters }: { supporters: Supporter[] }) {
  if (supporters.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-lg">
        No supporters yet.
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="grid grid-cols-12 px-4 py-2.5 bg-muted text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <div className="col-span-5">Wallet</div>
        <div className="col-span-2">Committed</div>
        <div className="col-span-3">Since</div>
        <div className="col-span-2 text-right">Points</div>
      </div>
      <ul>
        {supporters.map((s, i) => (
          <li
            key={i}
            className={`grid grid-cols-12 px-4 py-3 text-sm tabular-nums ${
              i < supporters.length - 1 ? "border-b" : ""
            }`}
          >
            <div className="col-span-5 font-mono text-xs sm:text-sm truncate">{s.wallet}</div>
            <div className="col-span-2">${fmt(s.amount)}</div>
            <div className="col-span-3 text-muted-foreground">{s.since}</div>
            <div className="col-span-2 text-right">{formatScore(s.points)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
