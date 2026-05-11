/**
 * ISO 3166-1 alpha-2 → flag-emoji helper.
 *
 * Two-letter ISO codes ("DE", "US", "JP") render as flag emoji on every
 * modern system via two Regional Indicator Symbol code points. We let the
 * platform draw the flag rather than shipping our own SVG set — same
 * approach `data/users.ts` takes when the persona-author hand-wrote
 * `location: "🇩🇪 Berlin"`.
 *
 * Returns null for malformed input so the caller can decide between a
 * silent skip and a fallback label. Used by RealAuthProvider when
 * mapping a founder's `country` (ISO code) into the `User.location`
 * free-form string the rest of the app consumes.
 */

const A_REGIONAL = 0x1f1e6;
const A_LATIN = 0x41;

export function flagFromCountry(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const code = iso.trim().toUpperCase();
  if (code.length !== 2) return null;
  // Both chars must be A-Z. Anything else (digits, punctuation) → null.
  for (let i = 0; i < 2; i++) {
    const c = code.charCodeAt(i);
    if (c < A_LATIN || c > A_LATIN + 25) return null;
  }
  const first = code.charCodeAt(0) - A_LATIN + A_REGIONAL;
  const second = code.charCodeAt(1) - A_LATIN + A_REGIONAL;
  return String.fromCodePoint(first, second);
}

/** Compose a flag + ISO label, e.g. "🇩🇪 DE". Returns just the ISO code if
 *  the flag emoji can't be derived. */
export function flagAndCountryLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const trimmed = iso.trim().toUpperCase();
  if (!trimmed) return null;
  const flag = flagFromCountry(trimmed);
  return flag ? `${flag} ${trimmed}` : trimmed;
}
