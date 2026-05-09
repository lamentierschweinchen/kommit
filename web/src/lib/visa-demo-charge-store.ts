/**
 * In-memory charge-state store for the visa-demo webhook → FE polling
 * bridge. SERVER-ONLY.
 *
 * State machine (handoff 46 — Codex M2 closure):
 *
 *     pending ─[markSettled]────► settled ─[tryRelay]────► relay_pending
 *                                    │                        │
 *                                    │                        ├─[markCompleted]──► completed (terminal)
 *                                    │                        │
 *                                    │                        └─[markRelayFailed]► relay_failed
 *                                    │                                                │
 *                                    │                                                │
 *                                    └─[markTerminalFailure]──► failed | expired      │
 *                                                                  (terminal)         │
 *                                                                                     │
 *                                                          ◄──[tryRelay (retry)]──────┘
 *
 * Why split `settled` from `completed`: the MoonPay webhook tells us the
 * card cleared and USDC arrived at OUR merchant wallet (= fee-payer). The
 * FE-visible "kommit confirmed" state requires a SECOND on-chain step —
 * the merchant→kommitter relay transfer — to actually succeed. Before
 * handoff 46 these were collapsed: webhook arrival → `completed`, and a
 * relay failure left a charge that LOOKED done while USDC was stranded
 * at the merchant wallet. Now `completed` is gated on the relay tx
 * signature being recorded, and a relay failure leaves a `relay_failed`
 * charge that the next duplicate webhook delivery will retry.
 *
 * Concurrency model: single Node.js process, single-threaded JS event
 * loop. `tryRelay` is the atomic CAS step — a synchronous read+write
 * inside one function call (no `await` boundary inside it), so two
 * concurrent webhook handlers cannot both acquire the relay slot. Once
 * one wins, the other sees `relay_pending` and returns
 * `relay-in-progress`.
 *
 * Sandbox-scale only — same memory-pruning shape as visa-demo-idempotency.ts
 * and visa-demo-rate-limit.ts (Codex M4 risk-accept applies the same way).
 * KV / Redis migration is v1 work; durable cross-instance CAS lands then.
 */

import "server-only";

const TTL_MS = 30 * 60 * 1000; // 30 min — covers a slow user + poll lifetime

/** 7-state lifecycle; see file-header diagram. */
export type ChargeState =
  | "pending"
  | "settled"
  | "relay_pending"
  | "relay_failed"
  | "completed"
  | "failed"
  | "expired";

/** True when the state will accept no further transitions. */
function isTerminal(s: ChargeState): boolean {
  return s === "completed" || s === "failed" || s === "expired";
}

export type ChargeRecord = {
  chargeId: string;
  /** Lifecycle position. See ChargeState above. */
  status: ChargeState;
  /** Wallet that initiated this charge. Used by the GET status route to
   *  auth-gate polling — only the originator can read their own charge. */
  kommitterWallet: string;
  /** Project the kommit is going to. */
  projectPda: string;
  projectSlug: string;
  /** USDC base units the charge was created for (reference at quote time). */
  amountUSDCReference: number;
  /** Final settled USDC base units from the webhook (set when settled). */
  amountUSDCSettled?: number;
  /** Solana transaction signature from MoonPay's settlement (the one that
   *  delivered USDC to our merchant wallet). Set when settled. */
  settlementSignature?: string;
  /** Solana tx signature for the merchant→kommitter relay transfer. Set
   *  only when status === "completed". The kommitter's wallet now holds
   *  the relayed USDC. */
  relaySignature?: string;
  /** Last relay-attempt failure reason. Set when status === relay_failed. */
  relayFailureReason?: string;
  /** Failure reason for terminal states (failed/expired). */
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

/**
 * Mark a charge as `settled`: MoonPay's webhook confirms card payment +
 * Solana settlement to the merchant wallet. Records the settled amount
 * and the settlement Solana tx signature. Idempotent: returns true on the
 * pending → settled transition; returns false if the charge is already
 * settled or further along (caller treats false as "already-processed,
 * carry on to the relay step").
 *
 * Replaces the prior `markCompleted` first half (handoff 46 § A).
 */
export function markSettled(args: {
  chargeId: string;
  amountUSDCSettled: number;
  settlementSignature: string;
}): boolean {
  const existing = byChargeId.get(args.chargeId);
  if (!existing) return false;
  if (existing.status !== "pending") return false;
  existing.status = "settled";
  existing.amountUSDCSettled = args.amountUSDCSettled;
  existing.settlementSignature = args.settlementSignature;
  existing.updatedAt = Date.now();
  return true;
}

/**
 * Acquire the relay slot via atomic CAS. Returns true iff the caller
 * transitions the charge from `settled` or `relay_failed` into
 * `relay_pending`. Returns false in every other case (charge unknown,
 * charge already mid-relay, charge already terminal, charge still
 * `pending`).
 *
 * Atomicity comes from JS single-threaded execution — there is no
 * `await` boundary inside this function, so two concurrent webhook
 * handlers cannot both observe `settled` and both write `relay_pending`.
 * Whichever is scheduled first wins; the other sees `relay_pending`
 * and returns false.
 */
export function tryRelay(chargeId: string): boolean {
  const existing = byChargeId.get(chargeId);
  if (!existing) return false;
  if (existing.status !== "settled" && existing.status !== "relay_failed") {
    return false;
  }
  existing.status = "relay_pending";
  existing.updatedAt = Date.now();
  return true;
}

/**
 * Record a successful relay. Caller must have previously acquired the
 * relay slot via `tryRelay`. Transitions `relay_pending → completed`.
 * No-op (returns false) if the charge isn't in `relay_pending`.
 */
export function markCompleted(args: {
  chargeId: string;
  relaySignature: string;
}): boolean {
  const existing = byChargeId.get(args.chargeId);
  if (!existing) return false;
  if (existing.status !== "relay_pending") return false;
  existing.status = "completed";
  existing.relaySignature = args.relaySignature;
  existing.relayFailureReason = undefined;
  existing.updatedAt = Date.now();
  return true;
}

/**
 * Record a failed relay attempt. Caller must have previously acquired
 * the relay slot via `tryRelay`. Transitions `relay_pending → relay_failed`.
 * The next duplicate webhook delivery will see `relay_failed` and re-try
 * via `tryRelay` again — that's the M2 fix's retry path.
 */
export function markRelayFailed(args: {
  chargeId: string;
  reason: string;
}): boolean {
  const existing = byChargeId.get(args.chargeId);
  if (!existing) return false;
  if (existing.status !== "relay_pending") return false;
  existing.status = "relay_failed";
  existing.relayFailureReason = args.reason;
  existing.updatedAt = Date.now();
  return true;
}

/** Mark a charge as failed/expired. Only legal from `pending` (MoonPay
 *  reported terminal-failure before the card cleared). Idempotent. */
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

/** True iff the charge is in `relay_failed` and a duplicate webhook
 *  should retry the relay. Mostly observability — the webhook handler
 *  also gets this signal from `tryRelay`'s return value. */
export function getRetryable(chargeId: string): boolean {
  const existing = byChargeId.get(chargeId);
  return !!existing && existing.status === "relay_failed";
}

/** True iff the charge is in any terminal state (no further transitions). */
export function isChargeTerminal(chargeId: string): boolean {
  const existing = byChargeId.get(chargeId);
  return !!existing && isTerminal(existing.status);
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
