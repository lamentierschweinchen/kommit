/**
 * Server-side feature gate for the Lane B sandbox API routes.
 *
 * SERVER-ONLY. Mirrors `visa-demo-mode.ts`: an independent gate so the
 * routes can be flipped on/off per environment without touching code.
 *
 * `SANDBOX_API_ENABLED=1` (server-only env, no NEXT_PUBLIC_ prefix) is
 * the gate. Default off. /api/sandbox/* routes return 503 + structured
 * error before any auth check or side effect when disabled.
 *
 * Distinct from the FE `/sandbox/*` routing — the page surfaces render
 * regardless (so judges hitting the URL early get a clear "not
 * configured" surface from the airdrop call rather than a broken page).
 */

import "server-only";

import { readSecret } from "@/lib/server-env";

const ENABLE_FLAG = "SANDBOX_API_ENABLED";
const ENABLED_VALUE = "1";

export function isSandboxApiEnabled(): boolean {
  return readSecret(ENABLE_FLAG) === ENABLED_VALUE;
}
