/**
 * POST /api/visa-demo/onramp — fiat → USDC sandbox onramp.
 *
 * The full sandbox round-trip:
 *   1. Auth caller (Privy session).
 *   2. Validate body (card + amountEUR + projectPda).
 *   3. Get a EUR → USDC quote from Helio sandbox (mock fallback if no key).
 *   4. Execute the onramp at Helio (mock fallback if no key).
 *   5. Record a structured Memo on devnet — fee-payer signs + submits;
 *      result is the `commitTxHash` returned to the client. Solscan-traceable.
 *
 * Note: this route does NOT fire the on-chain Anchor `commit` instruction.
 * The visa-sandbox demo is honest about being a sandbox: USDC arrives in
 * the user's wallet (via Helio sandbox), and a Memo tx records the demo
 * intent. v1+ would replace the memo with a real `commit` once Privy
 * server-side signing or a delegated-commit instruction lands. For the
 * submission video, the Memo tx serves as the on-chain proof.
 *
 * Hand-off 41 § E3.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import { requireCallerWallet } from "@/lib/auth-server";
import { quote, executeOnramp } from "@/lib/visa-demo-helio";
import { recordMemo } from "@/lib/visa-demo-rpc";
import { isFeePayerConfigured } from "@/lib/visa-demo-fee-payer";
import { takeRateLimit } from "@/lib/visa-demo-rate-limit";
import { isVisaApiEnabled } from "@/lib/visa-demo-mode";
import {
  amountEURSchema,
  idempotencyKeySchema,
} from "@/lib/visa-demo-bounds";
import { lookup, cache } from "@/lib/visa-demo-idempotency";
import type { OnrampResponse } from "@/lib/visa-demo-types";

export const runtime = "nodejs";

const RATE_LIMIT_MS = 5_000; // 1 onramp per wallet per 5s; lighter than pre-fund

// Sandbox card numbers we accept. Helio's sandbox accepts the well-known
// `4242...` and `4111...` patterns. Anything else → card-rejected.
const SANDBOX_ACCEPTED_PREFIXES = ["4242", "4111"];

// Codex H2 + M3: integer-finite-bounded amount; no client-side fxRate.
// Codex H1: idempotency key required; UUID-shape validated.
const REQ = z.object({
  card: z.object({
    number: z.string().min(12).max(24),
    exp: z.string().min(4).max(7),
    cvc: z.string().min(3).max(4),
    name: z.string().min(1).max(120),
  }),
  amountEUR: amountEURSchema,
  projectPda: z.string().min(32).max(64),
  projectSlug: z.string().min(1).max(80),
  idempotencyKey: idempotencyKeySchema,
});

type OnrampErrorCode =
  | "card-rejected"
  | "onramp-failed"
  | "commit-failed"
  | "rate-limit"
  | "idempotency-conflict"
  | "demo-api-disabled";

type OnrampSuccess = Extract<OnrampResponse, { ok: true }>;

function jsonError(error: OnrampErrorCode, status: number): NextResponse {
  const body: OnrampResponse = { ok: false, error };
  return NextResponse.json(body, { status });
}

function lastFour(card: string): string {
  const digits = card.replace(/\D/g, "");
  return digits.slice(-4) || "0000";
}

function looksLikeSandboxCard(number: string): boolean {
  const digits = number.replace(/\D/g, "");
  return SANDBOX_ACCEPTED_PREFIXES.some((p) => digits.startsWith(p));
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 0. Server-side feature gate (Codex M1).
  if (!isVisaApiEnabled()) {
    return jsonError("demo-api-disabled", 503);
  }

  // 1. Auth.
  const authed = await requireCallerWallet(req);
  if (authed instanceof Response) {
    return jsonError("onramp-failed", authed.status);
  }
  const callerWallet = authed.wallet;

  // 2. Validate body BEFORE rate-limit so an idempotent retry of an
  //    already-cached operation can short-circuit even if the caller is
  //    inside the rate-limit window. Validation is cheap; rate-limit
  //    burning a token on a body-malformed request just punishes the user.
  let body: z.infer<typeof REQ>;
  try {
    body = REQ.parse(await req.json());
  } catch {
    return jsonError("onramp-failed", 400);
  }

  // 3. Idempotency check (Codex H1). MUST come before rate-limit + Helio
  //    so a retry of an already-completed operation returns the cached
  //    result without burning another rate-limit slot or another Helio call.
  const dedup = lookup<OnrampSuccess>(callerWallet, body.idempotencyKey);
  if (dedup.kind === "hit") {
    return NextResponse.json<OnrampResponse>(dedup.result);
  }
  if (dedup.kind === "conflict") {
    return jsonError("idempotency-conflict", 409);
  }

  // 4. Rate limit (per wallet) — applied to NEW requests only.
  if (!takeRateLimit(callerWallet, RATE_LIMIT_MS)) {
    return jsonError("rate-limit", 429);
  }

  if (!looksLikeSandboxCard(body.card.number)) {
    return jsonError("card-rejected", 402);
  }

  let user: PublicKey;
  let projectPda: PublicKey;
  try {
    user = new PublicKey(callerWallet);
    projectPda = new PublicKey(body.projectPda);
  } catch {
    return jsonError("onramp-failed", 400);
  }

  // 5. Helio sandbox quote → execute.
  let q;
  try {
    q = await quote(body.amountEUR);
  } catch (e) {
    console.warn("[visa-demo/onramp] quote threw:", e);
    return jsonError("onramp-failed", 502);
  }
  // Codex M3: ignore any caller-supplied fxRate. Use only what Helio (or
  // the deterministic mock fallback) returned. Memo amount + response
  // amount derive from `q.amountUSDC` directly so attacker-controlled
  // body fields can't inflate the signed memo.
  const effectiveFxRate = q.fxRate;
  const amountUSDCBase = Math.round(q.amountUSDC * 1_000_000);

  try {
    const onrampResult = await executeOnramp({
      quote: q,
      recipient: callerWallet,
      cardLast4: lastFour(body.card.number),
    });
    if (onrampResult.status === "failed") {
      return jsonError("onramp-failed", 502);
    }
  } catch (e) {
    console.warn("[visa-demo/onramp] executeOnramp threw:", e);
    return jsonError("onramp-failed", 502);
  }

  // 6. Memo tx for Solscan traceability (Codex I1: this is the
  //    `memoTxHash` field in the response, NOT a real Anchor commit).
  let memoTxHash = `sandbox-no-feepayer-${Date.now()}`;
  if (isFeePayerConfigured()) {
    try {
      memoTxHash = await recordMemo("onramp", {
        user,
        projectPda,
        amountUSDC: amountUSDCBase,
      });
    } catch (e) {
      console.warn(
        "[visa-demo/onramp] recordMemo failed; memoTxHash will be a placeholder:",
        e,
      );
      // Don't fail the whole onramp — the Helio side already moved USDC
      // (or simulated it). Surface the placeholder hash so the frontend
      // success state still renders. Vercel logs flag the real failure.
    }
  } else {
    console.warn(
      "[visa-demo/onramp] KOMMIT_DEVNET_FEE_PAYER_SECRET unset; memoTxHash will be a placeholder. Sandbox demo still functions; Solscan link will be invalid.",
    );
  }

  // 7. Cache result keyed by (wallet, idempotencyKey) before returning,
  //    so the next retry within IDEMPOTENCY_TTL_MS is a no-op (Codex H1).
  const result: OnrampSuccess = {
    ok: true,
    amountUSDC: amountUSDCBase,
    fxRate: effectiveFxRate,
    memoTxHash,
    cardLast4: lastFour(body.card.number),
  };
  cache(callerWallet, body.idempotencyKey, result);

  return NextResponse.json<OnrampResponse>(result);
}
