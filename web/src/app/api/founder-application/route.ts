/**
 * POST /api/founder-application — capture a /build founder application.
 *
 * Backs handoff 73 item 7. The /build form was a 250ms stub; now its
 * submit handler calls this route, which validates + persists to the
 * `founder_applications` table (migration 0010).
 *
 * Public, unauthenticated — founders don't have a Privy wallet yet at
 * apply-time. Trust posture mirrors /api/waitlist:
 *   - Zod-validated body (server is authoritative; client zod is a
 *     convenience, never the gate).
 *   - Per-IP rate limit via `takeRateLimit` (60s window). Sandbox-grade.
 *   - IP HMAC'd before storage with WAITLIST_IP_HASH_KEY (same key as
 *     /api/waitlist — both are HMAC fingerprints; one secret keeps the
 *     surface area small).
 *
 * Email is NOT made unique — the founder may re-apply with a corrected
 * pitch. The admin queue is small enough to tolerate dupes; resolution
 * is human.
 */

import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { createHmac } from "node:crypto";
import { z } from "zod";

import { takeRateLimit } from "@/lib/sandbox-rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { readSecret } from "@/lib/server-env";

export const runtime = "nodejs";

const RATE_LIMIT_MS = 60_000; // 1 application per IP per 60s

// Match the zod schema in web/src/app/build/page.tsx exactly. Field set
// is locked by handoff 73 — don't extend without updating both sides.
const REQ = z.object({
  name: z.string().trim().min(1).max(120),
  pitch: z.string().trim().min(1).max(80),
  sector: z.string().trim().min(1).max(40),
  longer: z.string().trim().min(20).max(4000),
  founders: z.string().trim().min(1).max(2000),
  stage: z.string().trim().min(1).max(40),
  extra: z.string().trim().max(2000).optional(),
  email: z.string().trim().email().max(254),
});

type ErrorCode =
  | "invalid-input"
  | "rate-limit"
  | "config"
  | "server-error";

type Response =
  | { ok: true }
  | { ok: false; error: ErrorCode };

function jsonError(error: ErrorCode, status: number): NextResponse<Response> {
  return NextResponse.json<Response>({ ok: false, error }, { status });
}

function callerIP(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIP = req.headers.get("x-real-ip");
  if (realIP) return realIP.trim();
  return "unknown";
}

function hashIP(ip: string, key: string): string {
  return createHmac("sha256", key).update(ip).digest("hex");
}

export async function POST(req: NextRequest): Promise<NextResponse<Response>> {
  // 1. Validate body shape.
  let body: z.infer<typeof REQ>;
  try {
    body = REQ.parse(await req.json());
  } catch {
    return jsonError("invalid-input", 400);
  }

  // 2. Per-IP rate-limit.
  const ip = callerIP(req);
  if (!takeRateLimit(`founder-app:${ip}`, RATE_LIMIT_MS)) {
    return jsonError("rate-limit", 429);
  }

  // 3. Config — fail closed on missing secrets.
  const ipHashKey = readSecret("WAITLIST_IP_HASH_KEY");
  if (!ipHashKey) return jsonError("config", 500);

  let supabase;
  try {
    supabase = getSupabaseAdminClient();
  } catch {
    return jsonError("config", 500);
  }

  // 4. Insert. Column names map 1:1 to the form fields via the small
  //    adaptor below — keeps the human-readable form names in the UI and
  //    descriptive column names in the DB.
  const { error } = await supabase.from("founder_applications").insert({
    project_name: body.name,
    project_pitch: body.pitch,
    sector: body.sector,
    longer_pitch: body.longer,
    founders_blurb: body.founders,
    stage: body.stage,
    extra_notes: body.extra && body.extra.length > 0 ? body.extra : null,
    email: body.email,
    status: "new",
    ip_hash: hashIP(ip, ipHashKey),
  });

  if (error) {
    console.warn("[founder-application] insert failed:", error.message);
    return jsonError("server-error", 500);
  }

  return NextResponse.json<Response>({ ok: true });
}
