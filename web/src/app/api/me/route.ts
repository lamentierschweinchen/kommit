/**
 * GET /api/me — caller-wallet → enriched user record.
 *
 * Called by RealAuthProvider on sign-in. Looks up the calling wallet in the
 * `founders` table (migration 0009); if a row exists, the response carries
 * the founder identity + profile so the in-memory User shape can be
 * enriched with role=founder + ownsProject + bio + country + interests.
 *
 * If there's no founder row → `founder: null`. The caller treats them as a
 * regular real-Privy kommitter and falls through to wallet-only synthesis.
 *
 * Trust posture:
 *   - Auth: Privy session token via `requireCallerWallet` (same shape as
 *     /api/sandbox/airdrop and the rest of the authed API).
 *   - Reads only — no writes here. Editing is /api/me/profile.
 *   - Service-role Supabase read. The `founders` table has zero anon grants,
 *     so this is the only legitimate read path for browser-side code.
 */

import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { requireCallerWallet } from "@/lib/auth-server";
import { getFounderByWallet, type FounderRecord } from "@/lib/founders-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MeResponse =
  | { ok: true; founder: FounderRecord | null }
  | { ok: false; error: "auth" | "server-error" };

function jsonError(error: "auth" | "server-error", status: number): NextResponse<MeResponse> {
  return NextResponse.json<MeResponse>({ ok: false, error }, { status });
}

export async function GET(req: NextRequest): Promise<NextResponse<MeResponse>> {
  const authed = await requireCallerWallet(req);
  if (authed instanceof Response) {
    return jsonError("auth", authed.status);
  }

  try {
    const founder = await getFounderByWallet(authed.wallet);
    return NextResponse.json<MeResponse>({ ok: true, founder });
  } catch (e) {
    console.warn("[/api/me] founder lookup failed:", e);
    return jsonError("server-error", 500);
  }
}
