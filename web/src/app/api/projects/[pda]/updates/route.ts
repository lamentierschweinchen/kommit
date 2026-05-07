/**
 * GET /api/projects/[pda]/updates — public list of founder updates for a project.
 *
 * No auth. Returns visible (not-hidden) updates in posted_at desc order with
 * per-emoji reaction counts attached. Cache headers per dispatch:
 *   s-maxage=10, stale-while-revalidate=60
 *
 * Reaction counts are aggregated in-memory because PostgREST embedded
 * resources return rows, not group counts. v0.5 scale (a handful of updates,
 * ~tens of reactions each) is comfortably within memory bounds; if scale
 * changes, swap to a materialized view in a future migration.
 *
 * Reads via the anon client (RLS allows select on visible rows). Falls back
 * to the admin client only if the anon client isn't configured — never
 * required in normal operation.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export const runtime = "nodejs";

type UpdateRow = {
  id: string;
  project_pda: string;
  author_wallet: string;
  title: string;
  body: string;
  is_pivot: boolean;
  is_graduation: boolean;
  posted_at: string;
};

type ReactionRow = {
  update_id: string;
  emoji: string;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ pda: string }> },
) {
  const { pda } = await params;
  if (!pda || pda.length < 32 || pda.length > 64) {
    return NextResponse.json({ error: "invalid-pda" }, { status: 400 });
  }

  const sb = getSupabaseClient();

  const { data: updates, error: updatesErr } = await sb
    .from("project_updates")
    .select(
      "id, project_pda, author_wallet, title, body, is_pivot, is_graduation, posted_at",
    )
    .eq("project_pda", pda)
    .eq("hidden", false)
    .order("posted_at", { ascending: false })
    .limit(100);

  if (updatesErr) {
    return NextResponse.json(
      { error: "updates-fetch-failed", detail: updatesErr.message },
      { status: 500 },
    );
  }

  const updateIds = (updates ?? []).map((u) => u.id);
  let reactionCounts: Record<string, Record<string, number>> = {};

  if (updateIds.length > 0) {
    const { data: reactions, error: reactionsErr } = await sb
      .from("update_reactions")
      .select("update_id, emoji")
      .in("update_id", updateIds);

    if (reactionsErr) {
      // Non-fatal: still return updates, just without reaction counts.
      console.warn("reaction-fetch-failed:", reactionsErr.message);
    } else {
      reactionCounts = aggregateReactions(reactions ?? []);
    }
  }

  const enriched = (updates ?? []).map((u: UpdateRow) => ({
    ...u,
    reactions: reactionCounts[u.id] ?? {},
  }));

  return NextResponse.json(
    { updates: enriched },
    {
      status: 200,
      headers: {
        "cache-control": "public, s-maxage=10, stale-while-revalidate=60",
      },
    },
  );
}

function aggregateReactions(rows: ReactionRow[]): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    if (!out[r.update_id]) out[r.update_id] = {};
    out[r.update_id][r.emoji] = (out[r.update_id][r.emoji] ?? 0) + 1;
  }
  return out;
}
