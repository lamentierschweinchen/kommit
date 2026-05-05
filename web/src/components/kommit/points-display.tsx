/**
 * A quiet number with a label. Per design.md form-serves-function:
 * "points feel earned, not gamified" — no badges, no trophies, no sparkle.
 *
 * Accepts bigint (u128 from Anchor / Supabase) or number (mock constant)
 * and formats both safely via lib/money.formatPoints — no precision loss
 * on the bigint path past 2^53.
 */

import { formatPoints } from "@/lib/money";

export function PointsDisplay({
  value,
  label = "lifetime",
  size = "md",
  className = "",
}: {
  value: bigint | number;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-2xl",
  };
  return (
    <span className={`tabular-nums ${sizes[size]} ${className}`}>
      <span className="font-medium">{formatPoints(value)}</span>{" "}
      <span className="text-muted-foreground font-normal">{label} points</span>
    </span>
  );
}
