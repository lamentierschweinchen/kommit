/**
 * POST /api/waitlist — capture a coming-soon waitlist signup.
 *
 * Public, unauthenticated route. Lane A architecture rollout: `/` shows the
 * waitlist form, this route persists the row.
 *
 * Trust posture:
 *   - Inputs validated by zod (email regex + role enum).
 *   - Per-IP rate limit via `takeRateLimit` (60s window) — sandbox-grade
 *     defense against drive-by spam, not production-grade. The downstream
 *     unique index on `email` is the authoritative dedup.
 *   - Email already-signed-up returns 200 (don't leak who's on the list).
 *   - IP is hashed (SHA-256) before storage.
 *   - SUPABASE_SERVICE_ROLE_KEY missing → 500 with a clear `config` code,
 *     not a build-time crash. Coordinator must add the key in Vercel.
 *
 * Schema: see migrations/supabase/0005_waitlist.sql.
 */

import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";

import { takeRateLimit } from "@/lib/visa-demo-rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const RATE_LIMIT_MS = 60_000; // 1 signup per IP per 60s

// RFC-ish email regex. Not RFC 5321/5322 perfect (impossible inline) but
// rejects the common malformed shapes the HTML5 input doesn't catch on
// older browsers. Server is the authoritative gate.
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const REQ = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(254)
    .regex(EMAIL_RE, "invalid email"),
  role: z.enum(["backer", "builder"]),
});

type WaitlistErrorCode =
  | "invalid-input"
  | "rate-limit"
  | "config"
  | "server-error";

type WaitlistResponse =
  | { ok: true }
  | { ok: false; error: WaitlistErrorCode };

function jsonError(error: WaitlistErrorCode, status: number): NextResponse {
  const body: WaitlistResponse = { ok: false, error };
  return NextResponse.json(body, { status });
}

/** Best-effort caller IP. Falls back to a constant so rate-limit still
 *  functions for deployments where the header isn't populated. */
function callerIP(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    // First entry is the originating client per XFF spec; trim whitespace.
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIP = req.headers.get("x-real-ip");
  if (realIP) return realIP.trim();
  return "unknown";
}

function hashIP(ip: string): Buffer {
  return createHash("sha256").update(ip).digest();
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Validate body shape first so a bad payload returns 400 even if
  //    the env isn't configured (cleaner DX during local dev).
  let body: z.infer<typeof REQ>;
  try {
    body = REQ.parse(await req.json());
  } catch {
    return jsonError("invalid-input", 400);
  }

  // 2. Rate-limit per IP.
  const ip = callerIP(req);
  if (!takeRateLimit(`waitlist:${ip}`, RATE_LIMIT_MS)) {
    return jsonError("rate-limit", 429);
  }

  // 3. Service-role client. Throws (caught below) if env is missing.
  let supabase;
  try {
    supabase = getSupabaseAdminClient();
  } catch {
    // SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL missing in env.
    // Don't crash the build — return a clear 500 the FE can surface.
    return jsonError("config", 500);
  }

  // 4. Insert. Unique-index conflicts on email return ok:true (don't leak
  //    that the address is already signed up).
  const { error } = await supabase.from("waitlist_signups").insert({
    email: body.email,
    role: body.role,
    ip_hash: hashIP(ip),
  });

  if (error) {
    // Postgres unique violation is code 23505 in the standard; supabase-js
    // surfaces it as `error.code === "23505"`. Treat as no-op success.
    if (error.code === "23505") {
      return NextResponse.json<WaitlistResponse>({ ok: true });
    }
    console.warn("[waitlist] insert failed:", error.message);
    return jsonError("server-error", 500);
  }

  return NextResponse.json<WaitlistResponse>({ ok: true });
}
