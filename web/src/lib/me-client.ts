"use client";

/**
 * Browser-side client for the /api/me + /api/me/profile routes.
 *
 * Shared between RealAuthProvider (one-shot fetch on sign-in to enrich the
 * User shape) and the EditProfileModal (POST to save changes). Owns the
 * (auth-token-bearing) fetch wrapper so callers don't re-implement the
 * Privy-access-token wiring.
 */

import { getAccessToken } from "@privy-io/react-auth";
import type { FounderLink, FounderRecord } from "@/lib/founder-types";

export type { FounderLink, FounderRecord } from "@/lib/founder-types";

type MeResponse =
  | { ok: true; founder: FounderRecord | null }
  | { ok: false; error: string };

type ProfilePatchInput = {
  displayName?: string;
  country?: string | null;
  bio?: string | null;
  interests?: string[];
  links?: FounderLink[];
  avatarSeed?: number | null;
};

type ProfilePatchResponse =
  | { ok: true; founder: FounderRecord }
  | { ok: false; error: string };

async function authHeaders(): Promise<HeadersInit> {
  const token = await getAccessToken();
  if (!token) return { "content-type": "application/json" };
  return {
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
  };
}

export async function fetchMe(): Promise<FounderRecord | null> {
  const headers = await authHeaders();
  const res = await fetch("/api/me", { headers, cache: "no-store" });
  if (!res.ok) return null;
  const body = (await res.json()) as MeResponse;
  if (!body.ok) return null;
  return body.founder;
}

export async function patchMeProfile(
  patch: ProfilePatchInput,
): Promise<FounderRecord | null> {
  const headers = await authHeaders();
  const res = await fetch("/api/me/profile", {
    method: "POST",
    headers,
    body: JSON.stringify(patch),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as ProfilePatchResponse;
  if (!body.ok) return null;
  return body.founder;
}
