/**
 * Server-side env-var reader with consistent trimming + empty handling.
 *
 * SERVER-ONLY. Never import into a client component (the import "server-only"
 * directive throws at build-time if you do).
 *
 * Why this module exists (Codex L3): copy-paste of secrets into env stores
 * is a recurring bug class — May 6 saw `\n` contamination in Vercel
 * production env, May 8 hit it again in preview. Centralizing the read
 * path with `.trim()` + null-on-empty stops the next instance, and lets
 * downstream `isXxxConfigured()` checks branch on a single, normalized
 * answer rather than re-implementing trim/check at every call site.
 *
 * Usage:
 *
 *   import { readSecret } from "@/lib/server-env";
 *
 *   const key = readSecret("HELIO_API_KEY");        // string | null
 *   if (!key) return failClosed();                   // unconfigured
 *   const auth = `Bearer ${key}`;                    // safe — already trimmed
 */

import "server-only";

/**
 * Read a server-side env var, trim whitespace (including stray `\n` from
 * Vercel UI paste), and return null if the result is empty. Caller branches
 * on null = unconfigured.
 */
export function readSecret(name: string): string | null {
  const raw = process.env[name];
  if (raw === undefined || raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  return trimmed;
}

/**
 * True iff the env var is set AND non-empty after trim.
 * Convenience for `isXxxConfigured()`-style helpers — equivalent to
 * `readSecret(name) !== null` but reads cleaner at the call site.
 */
export function hasSecret(name: string): boolean {
  return readSecret(name) !== null;
}
