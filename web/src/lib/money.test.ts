import { describe, it, expect } from "vitest";
import {
  parseTokenAmount,
  formatTokenAmount,
  formatTokenAmountFixed,
  formatScore,
  formatPoints,
  toBigInt,
  validateAmount,
  U64_MAX,
  U128_MAX,
} from "./money";

describe("parseTokenAmount", () => {
  it("parses whole numbers", () => {
    expect(parseTokenAmount("100", 6)).toBe(100_000_000n);
    expect(parseTokenAmount("0", 6)).toBe(0n);
    expect(parseTokenAmount("1", 6)).toBe(1_000_000n);
  });

  it("parses decimals", () => {
    expect(parseTokenAmount("100.5", 6)).toBe(100_500_000n);
    expect(parseTokenAmount("100.50", 6)).toBe(100_500_000n);
    expect(parseTokenAmount("0.000001", 6)).toBe(1n);
    expect(parseTokenAmount("0.123456", 6)).toBe(123_456n);
  });

  it("trims whitespace", () => {
    expect(parseTokenAmount("  42  ", 6)).toBe(42_000_000n);
  });

  it("respects custom decimals", () => {
    expect(parseTokenAmount("1.5", 9)).toBe(1_500_000_000n);
    expect(parseTokenAmount("0.000000001", 9)).toBe(1n);
  });

  it("throws on too many decimal places", () => {
    expect(() => parseTokenAmount("0.0000001", 6)).toThrow(/Too many decimal places/);
    expect(() => parseTokenAmount("1.1234567", 6)).toThrow(/Too many decimal places/);
  });

  it("throws on negative input", () => {
    expect(() => parseTokenAmount("-1", 6)).toThrow(/Invalid amount/);
    expect(() => parseTokenAmount("-0.5", 6)).toThrow(/Invalid amount/);
  });

  it("throws on non-numeric input", () => {
    expect(() => parseTokenAmount("abc", 6)).toThrow(/Invalid amount/);
    expect(() => parseTokenAmount("1.2.3", 6)).toThrow(/Invalid amount/);
    expect(() => parseTokenAmount("1e10", 6)).toThrow(/Invalid amount/);
    expect(() => parseTokenAmount("", 6)).toThrow(/empty/);
    expect(() => parseTokenAmount("   ", 6)).toThrow(/empty/);
  });

  it("throws on u64 overflow", () => {
    // u64 max is 18,446,744,073,709,551,615; with 6 decimals that's
    // 18,446,744,073,709.551615 USDC. Anything past that overflows.
    expect(() => parseTokenAmount("18446744073710", 6)).toThrow(/exceeds u64/);
    expect(() => parseTokenAmount("99999999999999.999999", 6)).toThrow(/exceeds u64/);
  });

  it("accepts u64 max boundary", () => {
    expect(parseTokenAmount("18446744073709.551615", 6)).toBe(U64_MAX);
  });

  it("rejects non-string input", () => {
    // @ts-expect-error — defensive runtime check (number passed instead of string)
    expect(() => parseTokenAmount(100, 6)).toThrow(/expected string/);
    // @ts-expect-error — defensive runtime check (null passed instead of string)
    expect(() => parseTokenAmount(null, 6)).toThrow(/expected string/);
  });
});

describe("formatTokenAmount", () => {
  it("formats whole + fractional", () => {
    expect(formatTokenAmount(100_500_000n, 6)).toBe("100.5");
    expect(formatTokenAmount(1_000_000n, 6)).toBe("1");
    expect(formatTokenAmount(1n, 6)).toBe("0.000001");
    expect(formatTokenAmount(0n, 6)).toBe("0");
  });

  it("trims trailing zeros", () => {
    expect(formatTokenAmount(123_000n, 6)).toBe("0.123");
    expect(formatTokenAmount(1_500_000n, 6)).toBe("1.5");
  });

  it("handles negative values", () => {
    expect(formatTokenAmount(-100_500_000n, 6)).toBe("-100.5");
  });

  it("respects custom decimals", () => {
    expect(formatTokenAmount(1_500_000_000n, 9)).toBe("1.5");
  });

  it("round-trips against parseTokenAmount", () => {
    const samples = ["0", "1", "100.5", "0.000001", "18446744073709.551615"];
    for (const s of samples) {
      const parsed = parseTokenAmount(s, 6);
      const formatted = formatTokenAmount(parsed, 6);
      // formatTokenAmount drops trailing zeros, so re-parse to compare.
      expect(parseTokenAmount(formatted, 6)).toBe(parsed);
    }
  });
});

describe("formatTokenAmountFixed", () => {
  it("pads to min fraction digits", () => {
    expect(formatTokenAmountFixed(100_500_000n, 6, 2)).toBe("100.50");
    expect(formatTokenAmountFixed(1_000_000n, 6, 2)).toBe("1.00");
    expect(formatTokenAmountFixed(1n, 6, 2)).toBe("0.00");
  });

  it("respects max fraction digits", () => {
    expect(formatTokenAmountFixed(123_456n, 6, 0, 2)).toBe("0.12");
    expect(formatTokenAmountFixed(123_456n, 6, 6, 6)).toBe("0.123456");
  });

  it("adds thousands separators", () => {
    expect(formatTokenAmountFixed(1_234_567_890n, 6, 2)).toBe("1,234.56");
  });

  it("handles zero", () => {
    expect(formatTokenAmountFixed(0n, 6, 2)).toBe("0.00");
  });
});

describe("formatScore", () => {
  it("comma-separates", () => {
    expect(formatScore(123_456_789_012_345_678n)).toBe("123,456,789,012,345,678");
    expect(formatScore(1_000n)).toBe("1,000");
    expect(formatScore(999n)).toBe("999");
    expect(formatScore(0n)).toBe("0");
  });

  it("handles u128 boundary", () => {
    expect(formatScore(U128_MAX)).toBe(
      "340,282,366,920,938,463,463,374,607,431,768,211,455"
    );
  });

  it("throws on negative", () => {
    expect(() => formatScore(-1n)).toThrow(/cannot be negative/);
  });

  it("throws on overflow", () => {
    expect(() => formatScore(U128_MAX + 1n)).toThrow(/exceeds u128/);
  });
});

describe("formatPoints", () => {
  it("delegates bigint to formatScore", () => {
    expect(formatPoints(123_456n)).toBe("123,456");
    expect(formatPoints(123_456_789_012_345_678n)).toBe("123,456,789,012,345,678");
  });

  it("handles small numbers", () => {
    expect(formatPoints(47891)).toBe("47,891");
    expect(formatPoints(0)).toBe("0");
  });

  it("rounds fractional numbers", () => {
    expect(formatPoints(47891.7)).toBe("47,892");
  });

  it("throws on non-finite number", () => {
    expect(() => formatPoints(NaN)).toThrow();
    expect(() => formatPoints(Infinity)).toThrow();
  });
});

describe("toBigInt", () => {
  it("passes bigint through", () => {
    expect(toBigInt(42n)).toBe(42n);
  });

  it("parses integer strings", () => {
    expect(toBigInt("42")).toBe(42n);
    expect(toBigInt("-7")).toBe(-7n);
    expect(toBigInt("  100  ")).toBe(100n);
  });

  it("converts safe integer numbers", () => {
    expect(toBigInt(42)).toBe(42n);
    expect(toBigInt(0)).toBe(0n);
  });

  it("throws on unsafe number", () => {
    expect(() => toBigInt(2 ** 53)).toThrow(/safe integer/);
    expect(() => toBigInt(NaN)).toThrow(/finite integer/);
    expect(() => toBigInt(1.5)).toThrow(/finite integer/);
  });

  it("throws on bad string", () => {
    expect(() => toBigInt("abc")).toThrow(/invalid integer/);
    expect(() => toBigInt("1.5")).toThrow(/invalid integer/);
  });

  it("calls toString on objects (for Anchor BN)", () => {
    const fakeBN = { toString: () => "12345" };
    expect(toBigInt(fakeBN)).toBe(12345n);
  });
});

describe("validateAmount", () => {
  it("returns null for valid amounts", () => {
    expect(validateAmount("100", 6)).toBeNull();
    expect(validateAmount("0.5", 6)).toBeNull();
  });

  it("flags empty input", () => {
    expect(validateAmount("", 6)).toBe("Enter an amount");
    expect(validateAmount("   ", 6)).toBe("Enter an amount");
  });

  it("flags zero", () => {
    expect(validateAmount("0", 6)).toMatch(/greater than zero/);
    expect(validateAmount("0.0", 6)).toMatch(/greater than zero/);
  });

  it("flags malformed input", () => {
    const err = validateAmount("abc", 6);
    expect(err).toMatch(/Invalid amount/);
  });

  it("flags exceeding the cap", () => {
    const max = parseTokenAmount("100", 6);
    expect(validateAmount("101", 6, max)).toMatch(/exceeds 100/);
  });

  it("allows up to the cap", () => {
    const max = parseTokenAmount("100", 6);
    expect(validateAmount("100", 6, max)).toBeNull();
    expect(validateAmount("99.999999", 6, max)).toBeNull();
  });
});
