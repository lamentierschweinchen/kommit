/**
 * Sandbox-scale numeric bounds + shared zod helpers for the visa-demo
 * routes (Codex H2 closure). Centralized so the onramp + offramp routes
 * can't drift on what counts as a valid amount.
 *
 * Numbers are sandbox-only and not financial-grade — these caps just
 * close `Infinity` / `1e309` / negative-amount classes that make zod's
 * default `.positive()` slip. Real product money paths run through the
 * Anchor program's u64 ranges + on-chain checks; the visa-demo memo path
 * doesn't enter that space.
 */

import { z } from "zod";

/** Max EUR amount per single onramp call. Sandbox; pick something small
 *  enough to not look like real-world fraud testing in the Helio dashboard. */
export const MAX_DEMO_EUR = 10_000;

/** Max USDC base units (6 decimals) per single offramp call. 100,000 USDC. */
export const MAX_DEMO_USDC_BASE = 100_000_000_000;

/**
 * Zod schema for an EUR amount on the visa-demo onramp:
 *   - integer (no fractional cents — keeps memo-string parsing simple;
 *     UI rounds to whole EUR before submit)
 *   - finite (rejects `Infinity` from `JSON.parse("1e309")`)
 *   - 1 ≤ x ≤ MAX_DEMO_EUR
 */
export const amountEURSchema = z
  .number()
  .int()
  .finite()
  .min(1)
  .max(MAX_DEMO_EUR);

/**
 * Zod schema for a USDC base-units amount on the visa-demo offramp:
 *   - integer (USDC base units are u64 on-chain; fractional base units don't exist)
 *   - finite (rejects `Infinity`)
 *   - 1 ≤ x ≤ MAX_DEMO_USDC_BASE
 */
export const amountUSDCBaseSchema = z
  .number()
  .int()
  .finite()
  .min(1)
  .max(MAX_DEMO_USDC_BASE);

/**
 * UUID-shape schema for `idempotencyKey`. Codex H1: the FE generates a
 * fresh `crypto.randomUUID()` per user-initiated kommit/withdraw click.
 * UUIDv4 is the conventional shape; we accept any UUID variant since
 * `crypto.randomUUID()` may emit v4 today and could change later.
 */
export const idempotencyKeySchema = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    "expected RFC 4122 UUID",
  );
