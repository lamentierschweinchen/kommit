/**
 * POST /api/founder/updates — founder posts a new update for their project.
 *
 * Auth contract:
 *   1. Caller wallet resolved via Privy server-side verification (or mock-mode
 *      x-mock-wallet header in local dev — see lib/auth-server.ts).
 *   2. caller must equal projects.recipient_wallet for the target project_pda.
 *      The recipient_wallet is set by the on-chain `create_project` instruction
 *      and is the founder's canonical wallet.
 *
 * Inserts via the supabase-admin client (service_role, bypasses RLS).
 * Migration 0004 grants service_role full DML on project_updates and revokes
 * insert/update/delete from anon/authenticated, so this route is the only
 * write path that lands posts in the table.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireCallerWallet } from "@/lib/auth-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs"; // Privy server SDK + supabase-js need node primitives

const POST_BODY = z.object({
  project_pda:    z.string().min(32).max(64),         // base58 Solana pubkey
  title:          z.string().min(1).max(200),
  body:           z.string().min(1).max(10_000),
  is_pivot:       z.boolean().optional().default(false),
  is_graduation:  z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  const authed = await requireCallerWallet(req);
  if (authed instanceof Response) return authed;
  const callerWallet = authed.wallet;

  let parsed: z.infer<typeof POST_BODY>;
  try {
    const json = await req.json();
    parsed = POST_BODY.parse(json);
  } catch (e) {
    return NextResponse.json(
      { error: "invalid-body", detail: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }

  const sb = getSupabaseAdminClient();

  // 1. Look up the project + recipient_wallet so we can check ownership.
  const { data: project, error: projectErr } = await sb
    .from("projects")
    .select("pda, recipient_wallet")
    .eq("pda", parsed.project_pda)
    .maybeSingle();

  if (projectErr) {
    return NextResponse.json(
      { error: "project-lookup-failed", detail: projectErr.message },
      { status: 500 },
    );
  }
  if (!project) {
    return NextResponse.json({ error: "project-not-found" }, { status: 404 });
  }

  // 2. Ownership check: caller must be the project's recipient wallet.
  if (project.recipient_wallet !== callerWallet) {
    return NextResponse.json(
      { error: "not-project-founder" },
      { status: 403 },
    );
  }

  // 3. Insert the update.
  const { data: inserted, error: insertErr } = await sb
    .from("project_updates")
    .insert({
      project_pda:    parsed.project_pda,
      author_wallet:  callerWallet,
      title:          parsed.title,
      body:           parsed.body,
      is_pivot:       parsed.is_pivot,
      is_graduation:  parsed.is_graduation,
    })
    .select("id, project_pda, author_wallet, title, body, is_pivot, is_graduation, posted_at")
    .single();

  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: "insert-failed", detail: insertErr?.message ?? "unknown" },
      { status: 500 },
    );
  }

  return NextResponse.json({ update: inserted }, { status: 201 });
}
