"use client";

import { getAccessToken } from "@privy-io/react-auth";

const MOCK_AUTH = process.env.NEXT_PUBLIC_MOCK_AUTH === "1";

/**
 * Browser-side fetch wrapper that attaches the caller-wallet credentials
 * expected by the /api/* routes (see lib/auth-server.ts).
 *
 * - Mock mode: attaches `x-mock-wallet: <wallet>`. Caller passes the wallet
 *   from useAuth().user.wallet.
 * - Real mode: attaches `Authorization: Bearer <privy-access-token>`.
 */
export async function authedFetch(
  input: string,
  init: RequestInit & { mockWallet?: string | null } = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type") && init.body && typeof init.body === "string") {
    headers.set("content-type", "application/json");
  }

  if (MOCK_AUTH) {
    if (init.mockWallet) headers.set("x-mock-wallet", init.mockWallet);
  } else {
    const token = await getAccessToken();
    if (token) headers.set("authorization", `Bearer ${token}`);
  }

  const { mockWallet: _mw, ...rest } = init;
  void _mw;
  return fetch(input, { ...rest, headers });
}
