/**
 * Decimal-safe money + score helpers. Replaces unsafe `number` math
 * (`Math.round(amount * 10**6)`, `Number(u128)`) which loses precision
 * past 2^53 — fine for mock values, dangerous for arbitrary USDC and
 * u128 reputation scores.
 *
 * Per QA report finding M3.
 *
 * Conventions:
 *   - User input is always a decimal string ("100.5"); we never accept
 *     a JS number for token amounts.
 *   - Internal token amounts are bigint (u64 base units).
 *   - Scores are bigint (u128).
 *   - Anchor's BN takes a bigint via `new BN(value.toString())`.
 */

const U64_MAX = 2n ** 64n - 1n;
const U128_MAX = 2n ** 128n - 1n;

/**
 * Parse a decimal string into u64 base units.
 *
 * @param decimal — user-input decimal string, e.g. "100.50"
 * @param decimals — token decimals (USDC = 6)
 * @returns base units as bigint
 * @throws if the input is malformed, negative, has too many decimal places,
 *         or overflows u64
 */
export function parseTokenAmount(decimal: string, decimals: number = 6): bigint {
  if (typeof decimal !== "string") {
    throw new Error(`Invalid amount: expected string, got ${typeof decimal}`);
  }
  const trimmed = decimal.trim();
  if (trimmed.length === 0) {
    throw new Error(`Invalid amount: empty string`);
  }
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid amount: "${decimal}"`);
  }
  const [whole, fraction = ""] = trimmed.split(".");
  if (fraction.length > decimals) {
    throw new Error(`Too many decimal places (max ${decimals}): "${decimal}"`);
  }
  const padded = fraction.padEnd(decimals, "0");
  const baseUnits = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded);
  if (baseUnits > U64_MAX) {
    throw new Error(`Amount exceeds u64 max: "${decimal}"`);
  }
  return baseUnits;
}

/**
 * Format u64 base units as a decimal string for display. Trailing zeros
 * trimmed from the fraction; whole-only amounts return without a decimal point.
 *
 * @example
 * formatTokenAmount(100500000n, 6) === "100.5"
 * formatTokenAmount(1n, 6) === "0.000001"
 * formatTokenAmount(0n, 6) === "0"
 */
export function formatTokenAmount(baseUnits: bigint, decimals: number = 6): string {
  const negative = baseUnits < 0n;
  const abs = negative ? -baseUnits : baseUnits;
  const divisor = 10n ** BigInt(decimals);
  const whole = abs / divisor;
  const fraction = abs % divisor;
  const fractionStr = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  const out = fractionStr ? `${whole}.${fractionStr}` : `${whole}`;
  return negative ? `-${out}` : out;
}

/**
 * Format token amount with fixed minimum and maximum fractional digits,
 * for situations where you want stable column width (e.g. tabular display).
 *
 * @example
 * formatTokenAmountFixed(100500000n, 6, 2) === "100.50"
 * formatTokenAmountFixed(1n, 6, 2) === "0.00"
 */
export function formatTokenAmountFixed(
  baseUnits: bigint,
  decimals: number = 6,
  minFractionDigits: number = 2,
  maxFractionDigits: number = minFractionDigits
): string {
  if (maxFractionDigits > decimals) maxFractionDigits = decimals;
  if (minFractionDigits > maxFractionDigits) minFractionDigits = maxFractionDigits;
  const negative = baseUnits < 0n;
  const abs = negative ? -baseUnits : baseUnits;
  const divisor = 10n ** BigInt(decimals);
  const whole = abs / divisor;
  const fraction = abs % divisor;
  let fractionStr = fraction.toString().padStart(decimals, "0");
  // Truncate to maxFractionDigits (no rounding — display only; round on input).
  fractionStr = fractionStr.slice(0, maxFractionDigits);
  // Trim trailing zeros down to minFractionDigits.
  while (
    fractionStr.length > minFractionDigits &&
    fractionStr.endsWith("0")
  ) {
    fractionStr = fractionStr.slice(0, -1);
  }
  const wholeWithCommas = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const out = fractionStr ? `${wholeWithCommas}.${fractionStr}` : wholeWithCommas;
  return negative ? `-${out}` : out;
}

/**
 * Format a u128 score as a comma-separated decimal string. No locale or
 * suffix abbreviations — display the full number.
 *
 * @example
 * formatScore(123456789012345678n) === "123,456,789,012,345,678"
 * formatScore(0n) === "0"
 */
export function formatScore(score: bigint): string {
  if (score < 0n) {
    throw new Error(`Score cannot be negative: ${score}`);
  }
  if (score > U128_MAX) {
    throw new Error(`Score exceeds u128 max: ${score}`);
  }
  return score.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Format a points value safely whether it arrives as bigint (live u128 from
 * Anchor / Supabase) or number (mock constant). bigint goes through formatScore;
 * number through toLocaleString. Used by PointsDisplay so the same component
 * handles both data sources without precision loss on the bigint path.
 */
export function formatPoints(value: bigint | number): string {
  if (typeof value === "bigint") return formatScore(value);
  if (!Number.isFinite(value)) {
    throw new Error(`formatPoints: not a finite number: ${value}`);
  }
  return Math.round(value).toLocaleString("en-US");
}

/**
 * Convert a value coming out of Anchor (BN) or Supabase (numeric-as-string)
 * into a bigint. Strings, BN-shaped objects with a `.toString()`, bigints,
 * and (for legacy callers) numbers all flow through here.
 *
 * Preferred shape: pass a string or bigint. Numbers risk silent precision
 * loss past 2^53; we guard with a finite-and-safe-integer check but the
 * caller should still avoid this path for u64+/u128 fields.
 */
export function toBigInt(
  value: bigint | string | number | { toString(): string }
): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "string") {
    if (!/^-?\d+$/.test(value.trim())) {
      throw new Error(`toBigInt: invalid integer string: "${value}"`);
    }
    return BigInt(value.trim());
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw new Error(`toBigInt: not a finite integer: ${value}`);
    }
    if (!Number.isSafeInteger(value)) {
      throw new Error(`toBigInt: number not a safe integer (>= 2^53): ${value}`);
    }
    return BigInt(value);
  }
  if (value && typeof value.toString === "function") {
    return toBigInt(value.toString());
  }
  throw new Error(`toBigInt: unsupported type: ${typeof value}`);
}

/**
 * Convenience: validate a user-input decimal amount against a wallet/escrow
 * balance. Returns a normalized error string or null if valid.
 *
 * Used by CommitModal + WithdrawModal for inline validation.
 *
 * @param decimal — user-input string
 * @param decimals — token decimals
 * @param max — optional cap (e.g. user's USDC balance, or current commitment)
 */
export function validateAmount(
  decimal: string,
  decimals: number = 6,
  max?: bigint
): string | null {
  const trimmed = decimal.trim();
  if (trimmed.length === 0) return "Enter an amount";
  let parsed: bigint;
  try {
    parsed = parseTokenAmount(trimmed, decimals);
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  if (parsed === 0n) return "Amount must be greater than zero";
  if (max !== undefined && parsed > max) {
    return `Amount exceeds ${formatTokenAmount(max, decimals)}`;
  }
  return null;
}

export { U64_MAX, U128_MAX };
