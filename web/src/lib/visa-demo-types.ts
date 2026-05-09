/**
 * Shared API contract for the Visa-rails sandbox demo.
 *
 * Frontend stubs these (visa-demo-stub.ts) and calls them via
 * visa-demo-client.ts. Server routes under /api/visa-demo/* implement the
 * same shapes — one env flip (`NEXT_PUBLIC_VISA_SANDBOX=live`) swaps stub
 * for real.
 *
 * Handoff 44 rewrite: the original `OnrampRequest` carried card details
 * that were entered on our domain; the new shape just carries amount +
 * project + idempotency, because the user enters card details on
 * MoonPay's hosted checkout page after we redirect them. The response
 * carries `hostedUrl` (where the FE redirects) + `chargeId` (key for
 * polling completion state). `OfframpRequest`/`OfframpResponse` and the
 * `offramp` client method are deleted entirely — MoonPay Commerce has
 * no offramp endpoint, so withdraw stays on the existing on-chain Anchor
 * `WithdrawModal` flow with visa-mode chrome.
 */

// ---- Pre-fund --------------------------------------------------------------

export type PreFundResponse =
  | { ok: true; lamports: number }
  | { ok: false; error: "auth" | "rpc" | "rate-limit" | "demo-api-disabled" };

// ---- Idempotency -----------------------------------------------------------

/**
 * Codex H1: client-generated UUID per user-initiated kommit click. Server
 * keys a short-lived dedup map by `${wallet}:${idempotencyKey}` and returns
 * the prior result on duplicate (no second MoonPay call). Frontend reuses
 * the same key for in-flight retries (button double-click, network jitter)
 * and embeds it in the success-redirect URL so the post-redirect page can
 * find the right charge to poll.
 */
export type IdempotencyKey = string;

// ---- Onramp (charge create + redirect) -------------------------------------

export type OnrampRequest = {
  /** Whole-EUR amount. Server bounds-checks integer + finite + [1, MAX_DEMO_EUR]. */
  amountEUR: number;
  /** On-chain recipient PDA for the project being kommitted to. Derived
   *  client-side via `findProjectPda(new PublicKey(project.recipientWallet))`. */
  projectPda: string;
  /** Project slug — surfaces in webhook metadata + dashboard rendering. */
  projectSlug: string;
  /** Codex H1 — see IdempotencyKey above. Required. Doubles as the
   *  cross-redirect identifier embedded in successRedirectUrl. */
  idempotencyKey: IdempotencyKey;
};

export type OnrampResponse =
  | {
      ok: true;
      /** MoonPay charge ID — used by the FE success page to poll
       *  completion state via `/api/visa-demo/charge/{chargeId}`. */
      chargeId: string;
      /** Hosted checkout URL — frontend redirects user to this URL.
       *  Format: https://app.hel.io/charge/<token>. */
      hostedUrl: string;
      /** Reference USDC base units (6 decimals) at quote-time rate. The
       *  *actually settled* amount comes through on the webhook and is
       *  surfaced via the charge-status route. */
      amountUSDC: number;
      /** Reference EUR → USDC rate. Display-only — webhook is truth. */
      fxRate: number;
      /** Echo back the idempotency key so the FE can stash it for
       *  post-redirect polling if the URL is lost. */
      idempotencyKey: IdempotencyKey;
    }
  | {
      ok: false;
      error:
        | "charge-failed"
        | "rate-limit"
        | "idempotency-conflict"
        | "demo-api-disabled"
        | "moonpay-not-configured";
    };

// ---- Charge status (post-redirect FE polling) ------------------------------

/**
 * Charge lifecycle position. Handoff 46 (Codex M2 closure) split the
 * prior `completed` into `settled` / `relay_pending` / `relay_failed` /
 * `completed` so the FE can distinguish "MoonPay confirmed payment, but
 * our merchant→kommitter USDC relay hasn't landed yet" from "fully done."
 *
 *   pending       — charge created; user redirected to MoonPay; no webhook yet.
 *   settled       — webhook signature-verified; MoonPay confirmed the card +
 *                   delivered USDC to OUR merchant wallet. Relay NOT yet
 *                   attempted. Brief intermediate state.
 *   relay_pending — relay tx is in flight (webhook handler holding the slot).
 *                   Brief intermediate state.
 *   relay_failed  — relay attempted; failed. Retryable on the next duplicate
 *                   webhook delivery (MoonPay retries on its own cadence).
 *   completed     — relay tx signature recorded. The kommitter's wallet holds
 *                   the relayed USDC. ONLY this state is safe for the FE to
 *                   treat as "kommit confirmed."
 *   failed        — terminal MoonPay-side failure (FAILED/CANCELED webhook).
 *   expired       — TTL eviction at the charge-store level.
 */
export type ChargeStatus =
  | "pending"
  | "settled"
  | "relay_pending"
  | "relay_failed"
  | "completed"
  | "failed"
  | "expired";

export type ChargeStatusResponse =
  | {
      ok: true;
      chargeId: string;
      status: ChargeStatus;
      /** USDC base units actually settled. Set once status >= settled. */
      amountUSDCSettled?: number;
      /** Solana tx signature MoonPay used to deliver USDC to merchant
       *  wallet. Set once status >= settled. Solscan-traceable. */
      settlementSignature?: string;
      /** Solana tx signature for the merchant→kommitter relay transfer.
       *  Set ONLY when status === "completed". Presence of this field is
       *  the FE's gate for treating the charge as fully done. */
      relaySignature?: string;
      /** Last relay-attempt failure reason. Set when status ===
       *  "relay_failed". Surfaces in the success page's "settling on-chain
       *  is taking longer than expected" intermediate UI. */
      relayFailureReason?: string;
      /** Failure reason — set when status === failed/expired. */
      failureReason?: string;
      projectPda: string;
      projectSlug: string;
      idempotencyKey: IdempotencyKey;
    }
  | {
      ok: false;
      error: "not-found" | "auth" | "demo-api-disabled" | "wrong-wallet";
    };

// ---- Client surface --------------------------------------------------------

/** What both the stub and the live-routes client expose. The frontend
 *  imports this single shape and never branches on stub-vs-live at the
 *  call site. Withdraw is intentionally NOT here — it stays on the
 *  existing on-chain Anchor `WithdrawModal` flow with visa-mode chrome. */
export interface VisaDemoClient {
  preFund(): Promise<PreFundResponse>;
  /** Create a MoonPay charge + return the hosted URL for redirect. The FE
   *  is responsible for actually navigating the browser. */
  onramp(req: OnrampRequest): Promise<OnrampResponse>;
  /** Poll charge state by ID. Used by the success page after the user
   *  redirects back from MoonPay's hosted checkout. */
  chargeStatus(chargeId: string): Promise<ChargeStatusResponse>;
}
