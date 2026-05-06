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

export function sortProjects(projects: Project[], sort: SortKey): Project[] {
  const sorted = projects.slice();
  switch (sort) {
    case "kommitted":
      sorted.sort((a, b) => b.totalKommittedUSD - a.totalKommittedUSD);
      break;
    case "kommitters":
      sorted.sort((a, b) => b.kommittersCount - a.kommittersCount);
      break;
    case "recent":
    default:
      // Newest activeSince first
      sorted.sort((a, b) =>
        b.activeSinceISO.localeCompare(a.activeSinceISO),
      );
      break;
  }
  return sorted;
}
