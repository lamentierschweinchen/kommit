/**
 * In-memory charge-state store for the visa-demo webhook → FE polling
 * bridge. SERVER-ONLY.
 *
 * Webhook handler writes here on a verified `charge.completed`-equivalent
 * event; the FE success page polls `/api/visa-demo/charge/{chargeId}` to
 * pick up the result and trigger the client-side commit.
 *
 * Sandbox-scale only — same memory-pruning shape as visa-demo-idempotency.ts
 * and visa-demo-rate-limit.ts (Codex M4 risk-accept applies the same way).
 * KV / Redis migration is v1 work.
 *
 * Shape note: we key BY chargeId AND maintain a secondary index by
 * idempotencyKey. The chargeId is the natural key for everything (webhook
 * delivery, polling, idempotency at the MoonPay side); the idempotencyKey
 * lookup exists because the FE success page may not always have the
 * chargeId in the URL (depends on which redirect query params we choose).
 */

import "server-only";

const TTL_MS = 30 * 60 * 1000; // 30 min — covers a slow user + poll lifetime

export type ChargeRecord = {
  chargeId: string;
  /** Status of the underlying transaction. `pending` = charge created but
   *  no terminal webhook event yet; `completed` = SUCCESS/SETTLED received
   *  and we relayed USDC to the kommitter; `failed`/`expired` = terminal
   *  bad outcomes. */
  status: "pending" | "completed" | "failed" | "expired";
  /** Wallet that initiated this charge. Used by the GET status route to
   *  auth-gate polling — only the originator can read their own charge. */
  kommitterWallet: string;
  /** Project the kommit is going to. */
  projectPda: string;
  projectSlug: string;
  /** USDC base units the charge was created for (reference at quote time). */
  amountUSDCReference: number;
  /** Final settled USDC base units from the webhook (set on completion). */
  amountUSDCSettled?: number;
  /** Solana transaction signature from MoonPay's settlement (the one that
   *  delivered USDC to our merchant wallet). Surfaces in the success UI as
   *  the "real on-chain proof" Solscan link. */
  settlementSignature?: string;
  /** Solana tx signature for the merchant-→kommitter relay transfer that
   *  the webhook handler executes after a successful settlement. The
   *  kommitter's wallet now holds USDC and can run commitToProject. */
  relaySignature?: string;
  /** Failure reason — surfaces to the FE on `failed` for honest messaging. */
  failureReason?: string;
  /** Internal idempotency key the charge was created with. Doubles as a
   *  cross-redirect identifier (we embed it in successRedirectUrl). */
  idempotencyKey: string;
  /** Wall-clock when this record was first written. TTL eviction key. */
  createdAt: number;
  /** Last update timestamp for observability. */
  updatedAt: number;
};

const byChargeId = new Map<string, ChargeRecord>();
/** Secondary index: idempotencyKey → chargeId. */
const byIdemKey = new Map<string, string>();

function pruneExpired(now: number): void {
  for (const [k, v] of byChargeId) {
    if (now - v.createdAt > TTL_MS) {
      byChargeId.delete(k);
      byIdemKey.delete(v.idempotencyKey);
    }
  }
}

/** Insert a freshly-created charge in the `pending` state. Called by the
 *  onramp route immediately after createCharge succeeds. */
export function recordPending(args: {
  chargeId: string;
  kommitterWallet: string;
  projectPda: string;
  projectSlug: string;
  amountUSDCReference: number;
  idempotencyKey: string;
}): void {
  const now = Date.now();
  pruneExpired(now);
  const record: ChargeRecord = {
    chargeId: args.chargeId,
    status: "pending",
    kommitterWallet: args.kommitterWallet,
    projectPda: args.projectPda,
    projectSlug: args.projectSlug,
    amountUSDCReference: args.amountUSDCReference,
    idempotencyKey: args.idempotencyKey,
    createdAt: now,
    updatedAt: now,
  };
  byChargeId.set(args.chargeId, record);
  byIdemKey.set(args.idempotencyKey, args.chargeId);
}

/** Mark a charge as completed and stash the settlement details. Idempotent
 *  on chargeId — second call with the same chargeId returns false without
 *  overwriting. Webhook handler treats false as "already-processed dedup,
 *  return 200." */
export function markCompleted(args: {
  chargeId: string;
  amountUSDCSettled: number;
  settlementSignature: string;
}): boolean {
  const existing = byChargeId.get(args.chargeId);
  if (!existing) return false; // unknown charge; webhook for someone else's
  if (existing.status !== "pending") return false; // already terminal
  existing.status = "completed";
  existing.amountUSDCSettled = args.amountUSDCSettled;
  existing.settlementSignature = args.settlementSignature;
  existing.updatedAt = Date.now();
  return true;
}

/** Attach the merchant→kommitter relay signature to an already-completed
 *  charge. Called after the webhook handler successfully transfers USDC. */
export function attachRelaySignature(
  chargeId: string,
  relaySignature: string,
): void {
  const existing = byChargeId.get(chargeId);
  if (!existing) return;
  existing.relaySignature = relaySignature;
  existing.updatedAt = Date.now();
}

/** Mark a charge as failed/expired. Idempotent like markCompleted. */
export function markTerminalFailure(args: {
  chargeId: string;
  status: "failed" | "expired";
  reason: string;
}): boolean {
  const existing = byChargeId.get(args.chargeId);
  if (!existing) return false;
  if (existing.status !== "pending") return false;
  existing.status = args.status;
  existing.failureReason = args.reason;
  existing.updatedAt = Date.now();
  return true;
}

export function getByChargeId(chargeId: string): ChargeRecord | null {
  return byChargeId.get(chargeId) ?? null;
}

export function getByIdempotencyKey(idemKey: string): ChargeRecord | null {
  const chargeId = byIdemKey.get(idemKey);
  if (!chargeId) return null;
  return byChargeId.get(chargeId) ?? null;
}

/** Test-only reset hook. */
export function _resetChargeStore(): void {
  byChargeId.clear();
  byIdemKey.clear();
}
