/**
 * Format a Solana wallet address for tight UI surfaces.
 *
 * Real base58 pubkeys are 43–44 chars, which wrap awkwardly in single-line
 * layouts and don't fit the brutalist "wallet chip" affordance. The standard
 * crypto-UX pattern is to display a head + tail with an ellipsis between, and
 * copy the FULL string when the user hits the copy button.
 *
 * Strings shorter than `head + tail + 3` chars are returned unchanged — there's
 * nothing to elide.
 */
export function truncateAddress(address: string, head = 4, tail = 4): string {
  if (!address) return "";
  if (address.length <= head + tail + 3) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}
