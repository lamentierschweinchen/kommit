/**
 * Lazy-upsert static catalog updates into Supabase on first interaction.
 *
 * Static updates in `web/src/lib/data/projects.ts` are rendered with a
 * hash-derived id (`seedFallbackId`) and never persisted up-front. When a
 * real-Privy kommitter reacts or comments on one, the comments/reactions
 * routes hit a FK lookup that returns null — handoff 65 B1.
 *
 * This helper takes the update id, the slug+atISO hints passed on the URL,
 * and idempotently inserts the parent `project_updates` row so the caller
 * can proceed. Returns the row's `{ id, project_pda }` shape, or null when
 * the hints don't resolve to a known static update (so the caller can fall
 * back to 404).
 *
 * Handoff 69 B1: v0.5 has no indexer, so `projects(pda)` is also empty for
 * catalog wallets. We bootstrap that row too (idempotent) so the FK from
 * project_updates → projects is satisfied. See lazy-sybil.ts for the on-chain
 * fallback used by the sybil gate.
 */

import { PublicKey } from "@solana/web3.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getProject } from "@/lib/data/projects";
import { findProjectPda } from "@/lib/kommit";

export async function lazyUpsertStaticUpdate(
  sb: SupabaseClient,
  updateId: string,
  hints: { slug: string | null; atISO: string | null },
): Promise<{ id: string; project_pda: string } | null> {
  const { slug, atISO } = hints;
  if (!slug || !atISO) return null;
  const project = getProject(slug);
  if (!project?.recipientWallet) return null;
  const seed = project.updates.find((u) => u.atISO === atISO);
  if (!seed) return null;

  const projectPda = findProjectPda(
    new PublicKey(project.recipientWallet),
  ).toBase58();

  // 1. Ensure the projects row exists. The static catalog's recipient_wallet
  // points to an on-chain Project PDA, but v0.5 doesn't run an indexer that
  // populates `projects` from chain events — so the FK from project_updates
  // → projects fails unless we bootstrap it here.
  const { error: projectInsertErr } = await sb
    .from("projects")
    .upsert(
      {
        pda:                projectPda,
        recipient_wallet:   project.recipientWallet,
        metadata_uri_hash:  "\\x", // empty bytea — schema requires non-null
        cumulative_principal:    0,
        cumulative_yield_routed: 0,
        created_at:         new Date().toISOString(),
        last_seen_slot:     0,
      },
      { onConflict: "pda", ignoreDuplicates: true },
    );
  if (projectInsertErr) {
    console.warn("[lazy-upsert] projects upsert failed:", projectInsertErr.message);
  }

  const { data: inserted, error: insertErr } = await sb
    .from("project_updates")
    .insert({
      id:            updateId,
      project_pda:   projectPda,
      author_wallet: project.recipientWallet,
      title:         seed.title,
      body:          seed.body,
      is_pivot:      !!seed.isPivot,
      is_graduation: !!seed.isGraduation,
      posted_at:     `${seed.atISO}T12:00:00.000Z`,
    })
    .select("id, project_pda")
    .maybeSingle();

  if (!insertErr && inserted) return inserted;

  if (insertErr) {
    console.warn("[lazy-upsert] project_updates insert failed:", insertErr.message);
  }

  // Race or duplicate-key: another request promoted this row between our
  // lookup and insert. Re-fetch and treat as success.
  const { data: raced } = await sb
    .from("project_updates")
    .select("id, project_pda")
    .eq("id", updateId)
    .maybeSingle();
  return raced ?? null;
}
