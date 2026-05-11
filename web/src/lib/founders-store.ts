/**
 * Server-side reads/writes for the `founders` table (migration 0009).
 *
 * Single owner of the Supabase shape — every other module talks to this
 * layer rather than touching the `founders` table directly, so the column
 * names + the in-memory founder shape stay synchronized.
 *
 * SERVER-ONLY: imports `getSupabaseAdminClient` which is sealed against
 * client bundles via `import "server-only"` (see lib/supabase-admin.ts).
 *
 * Used by:
 *   - /api/me                 → fetch founder by wallet on sign-in
 *   - /api/me/profile         → edit own founder row
 *   - /profile/[slug]/page    → resolve a founder by slug (user_id OR wallet)
 *   - scripts/onboard_founder → upsert founder + mark application approved
 */

import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type {
  FounderLink,
  FounderProfileUpdate,
  FounderRecord,
  FounderUpsert,
} from "@/lib/founder-types";

export type {
  FounderLink,
  FounderProfileUpdate,
  FounderRecord,
  FounderUpsert,
} from "@/lib/founder-types";

type FounderRow = {
  wallet: string;
  user_id: string | null;
  email: string | null;
  display_name: string;
  role: string;
  project_slug: string | null;
  country: string | null;
  interests: unknown;
  bio: string | null;
  links: unknown;
  avatar_seed: number | null;
  created_at: string;
  updated_at: string;
};

function parseInterests(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

function parseLinks(raw: unknown): FounderLink[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): FounderLink[] => {
    if (!entry || typeof entry !== "object") return [];
    const e = entry as Record<string, unknown>;
    const label = typeof e.label === "string" ? e.label : null;
    const url = typeof e.url === "string" ? e.url : null;
    if (!label || !url) return [];
    return [{ label, url }];
  });
}

function rowToRecord(row: FounderRow): FounderRecord {
  return {
    wallet: row.wallet,
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    role: row.role === "admin" ? "admin" : "founder",
    projectSlug: row.project_slug,
    country: row.country,
    interests: parseInterests(row.interests),
    bio: row.bio,
    links: parseLinks(row.links),
    avatarSeed: row.avatar_seed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Fetch by Privy wallet address. Returns null when there's no founder row
 *  for this wallet (caller falls back to treating them as a regular
 *  kommitter). */
export async function getFounderByWallet(
  wallet: string,
): Promise<FounderRecord | null> {
  if (!wallet) return null;
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("founders")
    .select("*")
    .eq("wallet", wallet)
    .maybeSingle();
  if (error) {
    // Not-found surfaces as `data: null` with no error; anything else is real.
    console.warn("[founders-store] getFounderByWallet failed:", error.message);
    return null;
  }
  return data ? rowToRecord(data as FounderRow) : null;
}

/** Fetch by either persona-style user_id (e.g. "alice") OR raw wallet —
 *  matches `/profile/[slug]` resolution Priority 2. Returns the first
 *  match; user_id wins ties since the partial unique index keeps it
 *  globally unique. */
export async function getFounderBySlugOrWallet(
  slug: string,
): Promise<FounderRecord | null> {
  if (!slug) return null;
  const supabase = getSupabaseAdminClient();
  // Try user_id first — it's the human-readable handle the admin sets.
  const byUserId = await supabase
    .from("founders")
    .select("*")
    .eq("user_id", slug)
    .maybeSingle();
  if (byUserId.data) return rowToRecord(byUserId.data as FounderRow);
  // Fall through to wallet lookup.
  const byWallet = await supabase
    .from("founders")
    .select("*")
    .eq("wallet", slug)
    .maybeSingle();
  if (byWallet.error) {
    console.warn(
      "[founders-store] getFounderBySlugOrWallet wallet lookup failed:",
      byWallet.error.message,
    );
    return null;
  }
  return byWallet.data ? rowToRecord(byWallet.data as FounderRow) : null;
}

/** Update the editable profile fields on the calling founder's own row.
 *  Wallet identifies the row (caller-wallet → row-key); the API route is
 *  responsible for the auth check before invoking this. */
export async function updateFounderProfile(
  wallet: string,
  patch: FounderProfileUpdate,
): Promise<FounderRecord | null> {
  if (!wallet) return null;
  const supabase = getSupabaseAdminClient();

  // Compose the column-name patch — only include keys the caller asked us
  // to touch. Avoids stomping fields the editor doesn't surface (e.g.
  // role, project_slug, user_id, email — admin-managed).
  const update: Record<string, unknown> = {};
  if (patch.displayName !== undefined) update.display_name = patch.displayName;
  if (patch.country !== undefined) update.country = patch.country;
  if (patch.bio !== undefined) update.bio = patch.bio;
  if (patch.interests !== undefined) update.interests = patch.interests;
  if (patch.links !== undefined) update.links = patch.links;
  if (patch.avatarSeed !== undefined) update.avatar_seed = patch.avatarSeed;

  if (Object.keys(update).length === 0) {
    // Nothing to write — just return the current row for response shape parity.
    return getFounderByWallet(wallet);
  }

  const { data, error } = await supabase
    .from("founders")
    .update(update)
    .eq("wallet", wallet)
    .select("*")
    .maybeSingle();
  if (error) {
    console.warn("[founders-store] updateFounderProfile failed:", error.message);
    return null;
  }
  return data ? rowToRecord(data as FounderRow) : null;
}

/** Idempotent insert-or-update keyed by wallet. Used by the onboarding
 *  script — re-running it for the same wallet refreshes the row rather
 *  than erroring. */
export async function upsertFounder(
  input: FounderUpsert,
): Promise<FounderRecord | null> {
  const supabase = getSupabaseAdminClient();
  const row = {
    wallet: input.wallet,
    user_id: input.userId ?? null,
    email: input.email ?? null,
    display_name: input.displayName,
    role: input.role ?? "founder",
    project_slug: input.projectSlug ?? null,
    country: input.country ?? null,
    interests: input.interests ?? [],
    bio: input.bio ?? null,
    links: input.links ?? [],
    avatar_seed: input.avatarSeed ?? null,
  };
  const { data, error } = await supabase
    .from("founders")
    .upsert(row, { onConflict: "wallet" })
    .select("*")
    .maybeSingle();
  if (error) {
    console.warn("[founders-store] upsertFounder failed:", error.message);
    return null;
  }
  return data ? rowToRecord(data as FounderRow) : null;
}
