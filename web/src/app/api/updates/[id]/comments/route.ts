/**
 * /api/updates/[id]/comments — kommitter comments on a founder update (P2.2).
 *
 *   POST { body }  → posts a new comment; same sybil gate as reactions
 *   GET           → public list of visible (not-hidden) comments, chronological
 *
 * Body length: 1-2000 chars (also enforced in the table CHECK constraint).
 *
 * Auth pattern is identical to reactions: caller must be a kommitter of the
 * parent project. Founder soft-mod (hide a comment) is placeholder-only in
 * v0.5 — not exposed by this route.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireCallerWallet } from "@/lib/auth-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getSupabaseClient } from "@/lib/supabase";
import { lazyUpsertStaticUpdate } from "@/lib/server/lazy-update-upsert";

export const runtime = "nodejs";

const COMMENT_BODY = z.object({
  body: z.string().min(1).max(2000),
});

const UPDATE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: updateId } = await params;
  if (!UPDATE_ID_RE.test(updateId)) {
    return NextResponse.json({ error: "invalid-update-id" }, { status: 400 });
  }

  const authed = await requireCallerWallet(req);
  if (authed instanceof Response) return authed;
  const callerWallet = authed.wallet;

  let parsed: z.infer<typeof COMMENT_BODY>;
  try {
    parsed = COMMENT_BODY.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "invalid-body", detail: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }

  const sb = getSupabaseAdminClient();

  // 1. Parent update lookup → project_pda for the sybil gate.
  const { data: existing, error: updateErr } = await sb
    .from("project_updates")
    .select("id, project_pda")
    .eq("id", updateId)
    .maybeSingle();
  if (updateErr) {
    return NextResponse.json(
      { error: "update-lookup-failed", detail: updateErr.message },
      { status: 500 },
    );
  }

  // Lazy-upsert path (handoff 65 B1): static catalog updates from
  // `projects.ts` are rendered with a hash-derived id but never written to
  // Supabase. When the row is missing AND the client passed slug+atISO hints
  // on the URL, promote the parent update into project_updates so the
  // FK-bearing comment insert can proceed.
  let update = existing;
  if (!update) {
    update = await lazyUpsertStaticUpdate(sb, updateId, {
      slug: req.nextUrl.searchParams.get("slug"),
      atISO: req.nextUrl.searchParams.get("atISO"),
    });
  }

  if (!update) {
    return NextResponse.json({ error: "update-not-found" }, { status: 404 });
  }

  // 2. Sybil gate — must be a kommitter of the parent project.
  const { data: kommit, error: kommitErr } = await sb
    .from("commitments")
    .select("pda")
    .eq("user_wallet", callerWallet)
    .eq("project_pda", update.project_pda)
    .limit(1)
    .maybeSingle();
  if (kommitErr) {
    return NextResponse.json(
      { error: "kommit-lookup-failed", detail: kommitErr.message },
      { status: 500 },
    );
  }
  if (!kommit) {
    return NextResponse.json(
      { error: "not-a-kommitter-of-this-project" },
      { status: 403 },
    );
  }

  // 3. Insert comment.
  const { data: inserted, error: insertErr } = await sb
    .from("update_comments")
    .insert({
      update_id:     updateId,
      author_wallet: callerWallet,
      body:          parsed.body,
    })
    .select("id, update_id, author_wallet, body, posted_at")
    .single();

  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: "comment-failed", detail: insertErr?.message ?? "unknown" },
      { status: 500 },
    );
  }

  return NextResponse.json({ comment: inserted }, { status: 201 });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: updateId } = await params;
  if (!UPDATE_ID_RE.test(updateId)) {
    return NextResponse.json({ error: "invalid-update-id" }, { status: 400 });
  }

  const sb = getSupabaseClient();

  const { data: comments, error } = await sb
    .from("update_comments")
    .select("id, update_id, author_wallet, body, posted_at")
    .eq("update_id", updateId)
    .eq("hidden", false)
    .order("posted_at", { ascending: true })
    .limit(500);

  if (error) {
    return NextResponse.json(
      { error: "comments-fetch-failed", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { comments: comments ?? [] },
    {
      status: 200,
      headers: {
        "cache-control": "public, s-maxage=10, stale-while-revalidate=60",
      },
    },
  );
}
