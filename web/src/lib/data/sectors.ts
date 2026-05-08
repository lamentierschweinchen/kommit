/**
 * Sector chip styling.
 *
 * Pass-2 P2: collapsed the per-sector ad-hoc color map (`Climate: purple`,
 * `Fintech: white`, `Health: green`, etc.) — the values were inconsistent
 * across surfaces and signaled no actual hierarchy. Sectors now share one
 * neutral fill: white-on-black brutal chip. The brutalist frame carries the
 * visual weight; the sector text is the differentiator.
 *
 * If we ever want sector to read as a category cue (it doesn't today — the
 * 9 sectors don't map to a 4-color palette), introduce a documented
 * sector→color map here and update the chip rendering to read from it.
 */

export const SECTOR_CHIP_CLASS =
  "bg-white text-black border-black";

/** Convenience for legacy call sites that still pass `project.sector` through a map. */
export function sectorChipClass(_sector: string): string {
  void _sector;
  return SECTOR_CHIP_CLASS;
}
