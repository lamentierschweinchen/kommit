/**
 * Yield-routed display per design.md form-serves-function:
 * "$Y routed to [team] this week" — concrete dollars to a named team, not %APY.
 *
 * Real value swap path: derive from on-chain `cumulative_yield_routed` minus a
 * 7-day lookback (event log), or read from the off-chain indexer once it lands.
 */

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function YieldRoutedDisplay({
  amountUsd,
  team,
  className = "",
}: {
  amountUsd: number;
  team: string;
  className?: string;
}) {
  return (
    <div className={`text-sm ${className}`}>
      <div className="text-muted-foreground">Yield routed this week</div>
      <div className="text-2xl font-medium tabular-nums mt-1">${fmt(amountUsd)}</div>
      <div className="text-xs text-muted-foreground mt-1">
        to <span className="font-medium text-foreground">{team}</span>
      </div>
    </div>
  );
}
