/**
 * Server-side feature gate for the visa-demo API routes (Codex M1).
 *
 * SERVER-ONLY. The frontend's `NEXT_PUBLIC_VISA_SANDBOX` flag controls only
 * which client implementation runs (stub vs real fetch). It does NOT
 * control whether the routes themselves are available — without an
 * independent server-side gate, anyone authenticated can hit the routes
 * even when the FE is using the stub.
 *
 * `VISA_DEMO_API_ENABLED=1` (server-only env, no NEXT_PUBLIC_ prefix) is
 * the gate. Default off. Routes return 503 + structured error before any
 * auth check or side effect when disabled — clearly a feature-flag intent
 * (not a missing route, not an auth failure).
 *
 * The post-merge env-flip sequence (per handoff 43 § "Post-merge sequence")
 * sets `VISA_DEMO_API_ENABLED=1` AND `NEXT_PUBLIC_VISA_SANDBOX=live`
 * together. Either alone is incomplete:
 *   - flag-only without API gate = FE uses stub, server still exposes routes
 *   - API-only without flag      = server routes available, FE uses stub
 *   - both                       = full live integration
 */

import "server-only";

import { readSecret } from "@/lib/server-env";

const ENABLE_FLAG = "VISA_DEMO_API_ENABLED";
const ENABLED_VALUE = "1";

/**
 * True iff the visa-demo API routes are enabled. Server-only read of
 * `VISA_DEMO_API_ENABLED`; whitespace-trimmed via `readSecret`.
 */
export function isVisaApiEnabled(): boolean {
  return readSecret(ENABLE_FLAG) === ENABLED_VALUE;
}
