/**
 * A quiet number with a label. Per design.md form-serves-function:
 * "points feel earned, not gamified" — no badges, no trophies, no sparkle.
 */

const fmt = (n: number) => n.toLocaleString("en-US");

export function PointsDisplay({
  value,
  label = "lifetime",
  size = "md",
  className = "",
}: {
  value: number;
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
      <span className="font-medium">{fmt(value)}</span>{" "}
      <span className="text-muted-foreground font-normal">{label} points</span>
    </span>
  );
}
