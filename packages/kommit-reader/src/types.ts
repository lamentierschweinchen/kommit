/**
 * Public types for `@kommitapp/reader`.
 *
 * `KommitRecord` is the SDK-shaped projection of the on-chain `Commitment`
 * account — flat, integrators-friendly, all big numbers already coerced to
 * native `bigint`. No Anchor / BN handling required by callers.
 */

export type { Kommit } from "./idl/kommit";

/**
 * One conviction record between a wallet and a project. This is what the
 * Kommit program stores on-chain in the `Commitment` PDA at seeds
 * `[b"commitment", user, project]`. The SDK projects the raw account into
 * this shape.
 */
export type KommitRecord = {
  /** Address of the on-chain Commitment PDA itself (base58). */
  readonly commitmentPda: string;
  /** Kommitter's wallet address (base58). */
  readonly user: string;
  /** Project PDA the kommitter is backing (base58). */
  readonly project: string;
  /**
   * Active principal in token base units. USDC = 6 decimals, so
   * `1_000_000n` = $1.00. `0n` after a full withdraw.
   *
   * Stored on-chain as `u64`; SDK exposes as `bigint` for exactness.
   */
  readonly principal: bigint;
  /**
   * Unix timestamp (seconds) of the first commit (or last full-withdraw +
   * recommit) on this (user, project) pair.
   */
  readonly depositTs: number;
  /**
   * Active conviction score: `principal × seconds since last accrual`.
   * Resets to 0 on full withdraw. Stored as `u128`; SDK exposes as `bigint`.
   *
   * Note: the score does NOT auto-tick on read — it reflects the last
   * on-chain accrual. Integrators that need a live-ticking value should
   * compute `activeScore + principal * (now - lastAccrualTs)` themselves.
   */
  readonly activeScore: bigint;
  /**
   * Lifetime conviction score: cumulative across the whole history of this
   * (user, project) pair. Never decreases — even after a full withdraw the
   * lifetime score is preserved. Stored as `u128`; SDK exposes as `bigint`.
   */
  readonly lifetimeScore: bigint;
  /** Unix timestamp (seconds) of the last on-chain accrual write. */
  readonly lastAccrualTs: number;
};
