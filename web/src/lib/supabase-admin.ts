/**
 * Supabase service-role admin client. SERVER-ONLY.
 *
 * Codex § Layer 5: this module ships the service-role JWT — anything
 * imported here ends up server-side. The `import "server-only"` directive
 * makes Next.js fail the build if this module is ever pulled into a client
 * component, breaking the leak path at compile time rather than runtime.
 *
 * Usage: API route handlers (`/app/api/...`) and server-only helpers that
 * need to bypass RLS. Browser code MUST go through `@/lib/supabase` (anon).
 *
 * Migration 0003 locked function execute privileges to `service_role` only;
 * this client is the path that satisfies that grant. Migration 0004 added
 * three tables with table-level grants to `service_role` for the same
 * reason: writes to project_updates / update_reactions / update_comments
 * happen here, never via PostgREST anon.
 */

import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readSecret } from "@/lib/server-env";

let cached: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  if (cached) return cached;
  // Codex Pass 1 L4 closure: route both reads through `readSecret` so a
  // whitespace-pasted Vercel secret can't degrade the waitlist (or any
  // future service-role consumer) to runtime `server-error` — same hardening
  // applied to HELIO_* + KOMMIT_DEVNET_FEE_PAYER_SECRET on May 6.
  const url = readSecret("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = readSecret("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (server-side only)",
    );
  }
  // Defense in depth: if this somehow runs in the browser despite the
  // "server-only" import, throw before the service-role key is used.
  if (typeof window !== "undefined") {
    throw new Error(
      "getSupabaseAdminClient called in browser — service-role key must stay server-side",
    );
  }
  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
