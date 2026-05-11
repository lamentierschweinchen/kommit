/**
 * /api/updates/[id]/reactions — emoji reactions on a founder update.
 *
 *   POST   { emoji }  → upserts a reaction; idempotent on (update_id, user, emoji)
 *   DELETE { emoji }  → removes a reaction
 *
 * Sybil defense: caller must have at least one row in `commitments` where
 *   user_wallet=caller AND project_pda=update.project_pda
 * That is, only kommitters of THIS specific project can react. RLS doesn't
 * enforce this — it's enforced here in the API code, and migration 0004
 * blocks anon/authenticated table-level writes so the only way to insert
 * into update_reactions is through this route.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireCallerWallet } from "@/lib/auth-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { lazyUpsertStaticUpdate } from "@/lib/server/lazy-update-upsert";

export const runtime = "nodejs";

// Single-grapheme emoji guard. We don't try to be perfect with Unicode
// segmentation in the migration; instead the API layer caps total length
// at 16 characters, which lets through all realistic emoji + ZWJ sequences
// while blocking obvious abuse (paragraphs of text, etc.).
const REACTION_BODY = z.object({
  emoji: z.string().min(1).max(16),
});

const UPDATE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function authorizeReact(
  req: NextRequest,
  updateId: string,
): Promise<
  | { ok: true; wallet: string; projectPda: string }
  | { ok: false; res: Response }
> {
  if (!UPDATE_ID_RE.test(updateId)) {
    return {
      ok: false,
      res: NextResponse.json({ error: "invalid-update-id" }, { status: 400 }),
    };
  }

  const authed = await requireCallerWallet(req);
  if (authed instanceof Response) return { ok: false, res: authed };
  const callerWallet = authed.wallet;

  const sb = getSupabaseAdminClient();

  // 1. Fetch parent update → project_pda. Same lazy-upsert as the comments
  // route (handoff 65 B1): static catalog updates aren't in Supabase until
  // someone interacts with them. The client passes slug+atISO hints so the
  // server can promote the row on demand.
  const { data: existing, error: updateErr } = await sb
    .from("project_updates")
    .select("id, project_pda")
    .eq("id", updateId)
    .maybeSingle();

  if (updateErr) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: "update-lookup-failed", detail: updateErr.message },
        { status: 500 },
      ),
    };
  }
  let update = existing;
  if (!update) {
    update = await lazyUpsertStaticUpdate(sb, updateId, {
      slug: req.nextUrl.searchParams.get("slug"),
      atISO: req.nextUrl.searchParams.get("atISO"),
    });
  }
  if (!update) {
    return {
      ok: false,
      res: NextResponse.json({ error: "update-not-found" }, { status: 404 }),
    };
  }

  // 2. Sybil gate — caller must be a kommitter of the parent project.
  const { data: kommit, error: kommitErr } = await sb
    .from("commitments")
    .select("pda")
    .eq("user_wallet", callerWallet)
    .eq("project_pda", update.project_pda)
    .limit(1)
    .maybeSingle();

  if (kommitErr) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: "kommit-lookup-failed", detail: kommitErr.message },
        { status: 500 },
      ),
    };
  }
  if (!kommit) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: "not-a-kommitter-of-this-project" },
        { status: 403 },
      ),
    };
  }

  return { ok: true, wallet: callerWallet, projectPda: update.project_pda };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: updateId } = await params;

  const auth = await authorizeReact(req, updateId);
  if (!auth.ok) return auth.res;

  let body: z.infer<typeof REACTION_BODY>;
  try {
    body = REACTION_BODY.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "invalid-body", detail: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }

  const sb = getSupabaseAdminClient();

  // Idempotent insert via upsert on the composite primary key.
  const { error: insertErr } = await sb
    .from("update_reactions")
    .upsert(
      {
        update_id:   updateId,
        user_wallet: auth.wallet,
        emoji:       body.emoji,
      },
      { onConflict: "update_id,user_wallet,emoji", ignoreDuplicates: true },
    );

  if (insertErr) {
    return NextResponse.json(
      { error: "react-failed", detail: insertErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: updateId } = await params;

  const auth = await authorizeReact(req, updateId);
  if (!auth.ok) return auth.res;

  let body: z.infer<typeof REACTION_BODY>;
  try {
    body = REACTION_BODY.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "invalid-body", detail: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }

  const sb = getSupabaseAdminClient();

  const { error: deleteErr } = await sb
    .from("update_reactions")
    .delete()
    .eq("update_id", updateId)
    .eq("user_wallet", auth.wallet)
    .eq("emoji", body.emoji);

  if (deleteErr) {
    return NextResponse.json(
      { error: "unreact-failed", detail: deleteErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
