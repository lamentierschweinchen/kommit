/**
 * Server-side caller-wallet resolver. SERVER-ONLY.
 *
 * Two paths:
 *
 *   1. Production / staging — the browser sends `Authorization: Bearer <privy-access-token>`.
 *      We verify the token via @privy-io/server-auth, look up the user, and
 *      return the linked Solana wallet address.
 *
 *   2. Local dev mock — when `NEXT_PUBLIC_MOCK_AUTH=1` AND `NODE_ENV !==
 *      "production"`, we accept an `x-mock-wallet: <wallet>` header and
 *      trust it as the caller. This mirrors the existing mock-auth path
 *      in `@/lib/queries.ts` (`MOCK_AUTH` gate, line 21) and lets the
 *      P1.4 API routes function under the demo persona switcher without
 *      requiring a real Privy session for every E2E click.
 *
 * The mock path is gated by BOTH env flags so a leaked
 * `NEXT_PUBLIC_MOCK_AUTH=1` on a production deploy still fails closed (the
 * NODE_ENV check is the canonical "is this production" signal Vercel sets).
 */

import "server-only";

import type { NextRequest } from "next/server";
import { PrivyClient } from "@privy-io/server-auth";

const MOCK_AUTH_ENABLED =
  process.env.NEXT_PUBLIC_MOCK_AUTH === "1" &&
  process.env.NODE_ENV !== "production";

let privyClient: PrivyClient | null = null;
function getPrivyClient(): PrivyClient {
  if (privyClient) return privyClient;
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error(
      "NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET must be set for server-side Privy verification",
    );
  }
  privyClient = new PrivyClient(appId, appSecret);
  return privyClient;
}

export type AuthError =
  | { kind: "missing-token"; status: 401 }
  | { kind: "invalid-token"; status: 401 }
  | { kind: "no-solana-wallet"; status: 403 }
  | { kind: "config"; status: 500; message: string };

export type AuthResult =
  | { ok: true; wallet: string; mock: boolean }
  | { ok: false; error: AuthError };

/**
 * Resolve the caller's Solana wallet address. Returns either the wallet
 * string or a structured error suitable for direct use in a Response.
 *
 * Mock-mode (dev-only): trust the `x-mock-wallet` header.
 * Real-mode: verify the Privy access token from `Authorization: Bearer ...`
 * and pull the linked Solana wallet address from the user record.
 */
export async function resolveCallerWallet(req: NextRequest): Promise<AuthResult> {
  if (MOCK_AUTH_ENABLED) {
    const mockWallet = req.headers.get("x-mock-wallet");
    if (mockWallet && mockWallet.length > 0) {
      return { ok: true, wallet: mockWallet, mock: true };
    }
    // Fall through to Privy in case real auth is also wired in dev.
  }

  const authz = req.headers.get("authorization") ?? "";
  const match = authz.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { ok: false, error: { kind: "missing-token", status: 401 } };
  }
  const token = match[1];

  let userId: string;
  try {
    const claims = await getPrivyClient().verifyAuthToken(token);
    userId = claims.userId;
  } catch {
    return { ok: false, error: { kind: "invalid-token", status: 401 } };
  }

  let user: Awaited<ReturnType<PrivyClient["getUser"]>>;
  try {
    user = await getPrivyClient().getUser(userId);
  } catch (e) {
    return {
      ok: false,
      error: {
        kind: "config",
        status: 500,
        message: e instanceof Error ? e.message : "privy getUser failed",
      },
    };
  }

  // Find the linked Solana wallet. Privy returns linkedAccounts as a tagged
  // union; we want type='wallet' with chainType='solana'.
  const wallet = user.linkedAccounts.find((a) => {
    if (a.type !== "wallet") return false;
    // chainType lives on wallet-typed entries; cast guarded by the type check above.
    return (a as { chainType?: string }).chainType === "solana";
  }) as { address?: string } | undefined;

  if (!wallet?.address) {
    return { ok: false, error: { kind: "no-solana-wallet", status: 403 } };
  }
  return { ok: true, wallet: wallet.address, mock: false };
}

/**
 * Convenience wrapper: returns a JSON error Response if the auth check
 * fails, or the wallet string + a flag indicating which path resolved.
 * Routes that don't need Response shaping can call resolveCallerWallet
 * directly.
 */
export async function requireCallerWallet(
  req: NextRequest,
): Promise<{ wallet: string; mock: boolean } | Response> {
  const result = await resolveCallerWallet(req);
  if (result.ok) return { wallet: result.wallet, mock: result.mock };
  const status = result.error.status;
  const body = {
    error: result.error.kind,
    ...(result.error.kind === "config" ? { detail: result.error.message } : {}),
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
