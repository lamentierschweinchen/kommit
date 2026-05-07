/**
 * Supabase anon client. Browser-safe — RLS enforces all access control.
 *
 * Codex § Layer 5 separation: this module is anon-only. The service-role
 * counterpart lives at `@/lib/supabase-admin` and must NEVER be imported
 * into a client component or co-located with anon code.
 *
 * Usage: server reads (route handlers, server components) and client reads
 * both go through this. The anon key is safe to ship in the browser bundle
 * because RLS policies in migrations 0001-0004 enforce read-only access
 * with table-level grants revoking insert/update/delete.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set",
    );
  }
  cached = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
