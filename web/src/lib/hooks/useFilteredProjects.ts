"use client";

import { useMemo } from "react";
import { PROJECTS, type Project } from "@/lib/data/projects";
import type { BrowseFilters, SortKey } from "@/components/project/BrowseToolbar";

export function useFilteredProjects(filters: BrowseFilters): Project[] {
  return useMemo(() => filterProjects(PROJECTS, filters), [filters]);
}

export function filterProjects(projects: Project[], filters: BrowseFilters): Project[] {
  let result = projects.slice();
  if (filters.sectors.length > 0) {
    result = result.filter((p) => filters.sectors.includes(p.sector));
  }
  if (filters.stages.length > 0) {
    result = result.filter((p) => filters.stages.includes(p.state));
  }
  if (filters.query.trim()) {
    const q = filters.query.trim().toLowerCase();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.pitch.toLowerCase().includes(q) ||
        p.founders.some((f) => f.name.toLowerCase().includes(q)),
    );
  }
  return sortProjects(result, filters.sort);
}

/**
 * State-tier ordering applied BEFORE the inner sort key. Active projects
 * surface first because they're the live cohort. Just-listed sits in the
 * middle — fresh but not yet kommittable in some flows. Graduated lands
 * last because the round is closed and the row is a historical record,
 * not an action surface. Within each tier, the chosen sort key applies.
 */
const STATE_ORDER: Record<Project["state"], number> = {
  active: 0,
  "just-listed": 1,
  graduated: 2,
};

export function sortProjects(projects: Project[], sort: SortKey): Project[] {
  const sorted = projects.slice();
  let innerCompare: (a: Project, b: Project) => number;
  switch (sort) {
    case "kommitters":
      innerCompare = (a, b) => b.kommittersCount - a.kommittersCount;
      break;
    case "recent":
      innerCompare = (a, b) => b.activeSinceISO.localeCompare(a.activeSinceISO);
      break;
    case "alphabetical":
      innerCompare = (a, b) =>
        a.name.localeCompare(b.name, "en", { sensitivity: "base" });
      break;
    case "kommitted":
    default:
      innerCompare = (a, b) => b.totalKommittedUSD - a.totalKommittedUSD;
      break;
  }
  sorted.sort((a, b) => {
    const tier = STATE_ORDER[a.state] - STATE_ORDER[b.state];
    if (tier !== 0) return tier;
    // Inside the just-listed tier, surface the nearest launch date first.
    // For pre-launch projects the useful order is what's about to open next,
    // regardless of the selected sort key — they have no kommits, kommitters,
    // or listing-recency signal worth competing with launch order.
    if (a.state === "just-listed" && b.state === "just-listed") {
      return a.activeSinceISO.localeCompare(b.activeSinceISO);
    }
    return innerCompare(a, b);
  });
  return sorted;
}
