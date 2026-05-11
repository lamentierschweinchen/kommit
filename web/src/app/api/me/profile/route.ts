/**
 * POST /api/me/profile — founder edits their own profile fields.
 *
 * Authoritative on what a founder can change about themselves:
 *   - displayName, country (ISO), bio, interests, links, avatarSeed
 *
 * Excluded (admin-managed, edited via the onboarding script):
 *   - wallet, userId, email, role, projectSlug, created_at
 *
 * Trust posture:
 *   - Auth via Privy session token; the calling wallet is the row to update.
 *   - The founder row must already exist (admin onboards first). If no row
 *     exists for the caller, 404 — non-founders have nothing to edit here.
 *   - zod-validated body. Server is the authoritative gate; client zod is a
 *     convenience.
 *   - Service-role write; the `founders` table has no anon grants.
 */

import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireCallerWallet } from "@/lib/auth-server";
import { isSafeExternalUrl } from "@/lib/url-safety";
import {
  getFounderByWallet,
  updateFounderProfile,
  type FounderRecord,
} from "@/lib/founders-store";

export const runtime = "nodejs";

// Hard caps mirror the editor UI + the schema choices in users.ts. The
// renderer truncates more aggressively for layout, but we accept the
// generous max here so a paste-in long bio survives the round trip.
const REQ = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  // Empty string → null (founder cleared the field). Other strings →
  // upper-cased 2-letter ISO; reject malformed input.
  country: z
    .union([z.string().trim(), z.null()])
    .optional()
    .transform((v) => (v === undefined ? undefined : v ?? null))
    .refine(
      (v) => v === undefined || v === null || /^[A-Za-z]{2}$/.test(v),
      "country must be ISO 3166-1 alpha-2 (e.g. DE)",
    )
    .transform((v) =>
      v === undefined ? undefined : v === null ? null : v.toUpperCase(),
    ),
  bio: z
    .union([z.string().trim().max(2000), z.null()])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === null ? null : v || null)),
  interests: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  links: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(40),
        url: z
          .string()
          .trim()
          .url()
          .max(300)
          .refine(isSafeExternalUrl, "profile links must use https"),
      }),
    )
    .max(20)
    .optional(),
  avatarSeed: z
    .union([z.number().int().min(1).max(70), z.null()])
    .optional(),
});

type ErrorCode = "auth" | "invalid-input" | "not-a-founder" | "server-error";

type PostResponse =
  | { ok: true; founder: FounderRecord }
  | { ok: false; error: ErrorCode };

function jsonError(error: ErrorCode, status: number): NextResponse<PostResponse> {
  return NextResponse.json<PostResponse>({ ok: false, error }, { status });
}

export async function POST(req: NextRequest): Promise<NextResponse<PostResponse>> {
  // 1. Auth.
  const authed = await requireCallerWallet(req);
  if (authed instanceof Response) {
    return jsonError("auth", authed.status);
  }

  // 2. Validate body.
  let body: z.infer<typeof REQ>;
  try {
    body = REQ.parse(await req.json());
  } catch {
    return jsonError("invalid-input", 400);
  }

  // 3. Caller must already be a founder. Non-founder authed wallets get
  //    a 404-shaped response — there's no row to edit.
  const existing = await getFounderByWallet(authed.wallet);
  if (!existing) {
    return jsonError("not-a-founder", 404);
  }

  // 4. Apply the patch. updateFounderProfile only touches keys the caller
  //    explicitly set, so partial PATCH-shaped semantics work even though
  //    the HTTP verb is POST (Next route handlers don't expose PATCH
  //    natively without extra wiring).
  const updated = await updateFounderProfile(authed.wallet, body);
  if (!updated) {
    return jsonError("server-error", 500);
  }
  return NextResponse.json<PostResponse>({ ok: true, founder: updated });
}
