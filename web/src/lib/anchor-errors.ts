/**
 * Anchor error mapper. Pass-2 minimum: turn raw RPC/Anchor exceptions into
 * user-safe strings per Codex § Layer 5: "Surface mapped Anchor errors to
 * users; do not display raw internal error strings from RPC/Supabase."
 *
 * The kind `"user_cancel"` is special — caller should stay silent.
 */

export type MappedError = {
  kind: "user_cancel" | "insufficient_funds" | "rate_limited" | "network" | "unknown";
  /** User-safe headline for a toast title. */
  title: string;
  /** User-safe one-line detail. */
  detail?: string;
};

export function mapAnchorError(err: unknown): MappedError {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const lower = raw.toLowerCase();

  // Privy / wallet-adapter cancellations
  if (
    lower.includes("user rejected") ||
    lower.includes("user denied") ||
    lower.includes("rejected request") ||
    lower.includes("cancelled") ||
    lower.includes("canceled") ||
    lower.includes("modal closed")
  ) {
    return { kind: "user_cancel", title: "" };
  }

  if (
    lower.includes("insufficient funds") ||
    lower.includes("insufficient lamports") ||
    lower.includes("custom program error: 0x1") || // SystemProgram InsufficientFunds
    lower.includes("0x1772") // common Anchor InsufficientFunds-shaped code
  ) {
    return {
      kind: "insufficient_funds",
      title: "Not enough USDC in your wallet.",
      detail: "Top up your devnet USDC and try again.",
    };
  }

  if (
    lower.includes("429") ||
    lower.includes("rate limit") ||
    lower.includes("too many requests")
  ) {
    return {
      kind: "rate_limited",
      title: "Network's busy.",
      detail: "Try again in a few seconds.",
    };
  }

  if (
    lower.includes("failed to fetch") ||
    lower.includes("network request failed") ||
    lower.includes("connection refused")
  ) {
    return {
      kind: "network",
      title: "Couldn't reach Solana.",
      detail: "Check your connection and try again.",
    };
  }

  return {
    kind: "unknown",
    title: "Try again.",
    detail: undefined,
  };
}
