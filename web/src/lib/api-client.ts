"use client";

import { getAccessToken } from "@privy-io/react-auth";
import { isDemoMode } from "@/lib/demo-mode";
import { demoFetch } from "@/lib/demo-engagement";

/**
 * Browser-side fetch wrapper that attaches the caller-wallet credentials
 * expected by the /api/* routes (see lib/auth-server.ts).
 *
 * - Demo mode: short-circuits to `demoFetch` when the URL matches an
 *   engagement-loop endpoint. The simulator persists state in localStorage
 *   and returns a Response with the same shape the real route would. Other
 *   URLs fall through to the network without auth headers (mock-wallet
 *   would 401 on production builds anyway).
 * - Real mode: attaches `Authorization: Bearer <privy-access-token>`.
 */
export async function authedFetch(
  input: string,
  init: RequestInit & { mockWallet?: string | null } = {},
): Promise<Response> {
  if (isDemoMode()) {
    const simulated = await demoFetch(input, init);
    if (simulated) return simulated;
    // Engagement endpoint not matched → fall through. We still skip the
    // Privy bearer because the user isn't actually signed in via Privy
    // when in demo mode.
    return fetch(input, stripMockWallet(init));
  }

  const headers = new Headers(init.headers);
  if (!headers.has("content-type") && init.body && typeof init.body === "string") {
    headers.set("content-type", "application/json");
  }
  const token = await getAccessToken();
  if (token) headers.set("authorization", `Bearer ${token}`);

  return fetch(input, { ...stripMockWallet(init), headers });
}

function stripMockWallet(
  init: RequestInit & { mockWallet?: string | null },
): RequestInit {
  const { mockWallet: _mw, ...rest } = init;
  void _mw;
  return rest;
}
