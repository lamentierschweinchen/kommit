/**
 * Format a Solana wallet address for tight UI surfaces.
 *
 * Real base58 pubkeys are 43–44 chars, which wrap awkwardly in single-line
 * layouts and don't fit the brutalist "wallet chip" affordance. The standard
 * crypto-UX pattern is to display a head + tail with an ellipsis between, and
 * copy the FULL string when the user hits the copy button.
 *
 * Defaults match Privy's own export-wallet modal display (5 + ... + 4) so the
 * same address visually matches across our surfaces and the embedded wallet
 * UI. Mixing truncations (5/4 vs 6/6) made users read the same wallet as two
 * different addresses.
 *
 * Strings shorter than `head + tail + 3` chars are returned unchanged — there's
 * nothing to elide.
 */
export function truncateAddress(address: string, head = 5, tail = 4): string {
  if (!address) return "";
  if (address.length <= head + tail + 3) return address;
  return `${address.slice(0, head)}...${address.slice(-tail)}`;
}
