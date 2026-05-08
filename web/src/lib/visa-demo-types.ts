/**
 * Shared API contract for the Visa-rails sandbox demo.
 *
 * Frontend stubs these (visa-demo-stub.ts) and calls them via
 * visa-demo-client.ts. Engineer (handoff 41) implements the real routes
 * under /api/visa-demo/{pre-fund,onramp,offramp} against the same shapes —
 * one env flip (`NEXT_PUBLIC_VISA_SANDBOX=live`) swaps stub for real.
 *
 * The frontend never reaches into Privy / Anchor / Solana directly in the
 * Visa-flavored flow. All on-chain action goes through these routes; the
 * user surface stays card-vocabulary-only.
 */

// ---- Card ------------------------------------------------------------------

/** Sandbox test cards only. The Helio sandbox accepts the well-known
 *  `4242 4242 4242 4242` pattern; stub also accepts any 16-digit string for
 *  local-dev quickness. */
export type SandboxCard = {
  number: string;
  exp: string; // MM/YY
  cvc: string;
  name: string;
};

// ---- Pre-fund --------------------------------------------------------------

export type PreFundResponse =
  | { ok: true; lamports: number }
  | { ok: false; error: "auth" | "rpc" | "rate-limit" };

// ---- Onramp ----------------------------------------------------------------

export type OnrampRequest = {
  card: SandboxCard;
  amountEUR: number;
  /** On-chain recipient PDA for the project being kommitted to. Derived
   *  client-side via `findProjectPda(new PublicKey(project.recipientWallet))`. */
  projectPda: string;
  /** Project slug — stub uses this to key the simulated position so the
   *  dashboard renders the new commit without round-tripping the chain. */
  projectSlug: string;
  /** Optional override; server uses live FX otherwise. */
  fxRate?: number;
};

export type OnrampResponse =
  | {
      ok: true;
      /** USDC base units (6 decimals). e.g. 54_350_000 ≈ $54.35. */
      amountUSDC: number;
      /** EUR → USDC rate used. For display ("Charged €50 at 1.087 EUR/USDC"). */
      fxRate: number;
      /** Solana devnet transaction signature for the commit. */
      commitTxHash: string;
      /** Card last-4 for the success toast continuity. */
      cardLast4: string;
    }
  | {
      ok: false;
      error: "card-rejected" | "onramp-failed" | "commit-failed" | "rate-limit";
    };

// ---- Offramp ---------------------------------------------------------------

export type OfframpRequest = {
  /** USDC base units to withdraw + payout. */
  amountUSDC: number;
  /** PDA the withdraw is pulled from (i.e. the project account). */
  projectPda: string;
  /** Project slug for stub bookkeeping. */
  projectSlug: string;
  /** Card last-4 — passes through for display continuity in the success toast. */
  cardLast4: string;
};

export type OfframpResponse =
  | {
      ok: true;
      /** EUR amount actually credited back. */
      amountEUR: number;
      /** Solana devnet withdraw signature. */
      withdrawTxHash: string;
      /** Sandbox payout reference (Helio / Mercuryo handle). */
      payoutId: string;
    }
  | { ok: false; error: "withdraw-failed" | "offramp-failed" | "rate-limit" };

// ---- Client surface --------------------------------------------------------

/** What both the stub and the live-routes client expose. The frontend imports
 *  this single shape and never branches on stub-vs-live at the call site. */
export interface VisaDemoClient {
  preFund(): Promise<PreFundResponse>;
  onramp(req: OnrampRequest): Promise<OnrampResponse>;
  offramp(req: OfframpRequest): Promise<OfframpResponse>;
}
