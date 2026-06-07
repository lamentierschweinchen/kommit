import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

type RateLimitRow = {
  allowed?: unknown;
  current_count?: unknown;
  reset_at?: unknown;
};

export type RateLimitDecision =
  | { ok: true; resetAt?: string }
  | {
      ok: false;
      error: "rate-limit" | "rate-limit-check-failed";
      detail?: string;
      resetAt?: string;
    };

type RateLimitOptions = {
  identifier: string;
  limit: number;
  windowSeconds: number;
};

function firstRow(data: unknown): RateLimitRow | null {
  if (Array.isArray(data)) {
    const [row] = data;
    return row && typeof row === "object" ? (row as RateLimitRow) : null;
  }
  return data && typeof data === "object" ? (data as RateLimitRow) : null;
}

export async function consumeRateLimit(
  supabase: SupabaseClient,
  options: RateLimitOptions,
): Promise<RateLimitDecision> {
  const identifier = options.identifier.trim();
  if (
    identifier.length === 0 ||
    !Number.isInteger(options.limit) ||
    !Number.isInteger(options.windowSeconds) ||
    options.limit <= 0 ||
    options.windowSeconds <= 0
  ) {
    return {
      ok: false,
      error: "rate-limit-check-failed",
      detail: "invalid rate-limit options",
    };
  }

  const { data, error } = await supabase.rpc("take_rate_limit", {
    p_identifier: identifier,
    p_limit: options.limit,
    p_window_seconds: options.windowSeconds,
  });

  if (error) {
    return {
      ok: false,
      error: "rate-limit-check-failed",
      detail: error.message,
    };
  }

  const row = firstRow(data);
  if (!row || typeof row.allowed !== "boolean") {
    return {
      ok: false,
      error: "rate-limit-check-failed",
      detail: "malformed rate-limit response",
    };
  }

  const resetAt = typeof row.reset_at === "string" ? row.reset_at : undefined;
  if (!row.allowed) {
    return { ok: false, error: "rate-limit", resetAt };
  }

  return { ok: true, resetAt };
}
