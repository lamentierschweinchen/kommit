"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/cn";
import type { Sector } from "@/lib/data/projects";
import { Icon } from "@/components/common/Icon";

export type SortKey = "recent" | "kommitted" | "kommitters";
const SORT_LABELS: Record<SortKey, string> = {
  recent: "Most recent",
  kommitted: "Most kommitted",
  kommitters: "Most kommitters",
};

const SECTOR_OPTIONS: Sector[] = [
  "Climate",
  "Fintech",
  "Bio",
  "Health",
  "Edu",
  "Consumer",
  "Creator tools",
  "Media",
  "Community",
];

export type StageOption = "active" | "graduated" | "just-listed";
const STAGE_OPTIONS: { value: StageOption; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "just-listed", label: "Just listed" },
  { value: "graduated", label: "Graduated" },
];

export type BrowseFilters = {
  sectors: Sector[];
  stages: StageOption[];
  query: string;
  sort: SortKey;
};

/**
 * Audit fixes baked in:
 * #4 — drop the in-toolbar duplicate search; we only show this toolbar's search input on browse,
 *      and the AuthHeader hides its search on /projects.
 * #5 — sort goes RIGHT (next to search). No vertical pipe separator. Filter chips left.
 */
export function BrowseToolbar({
  filters,
  onChange,
}: {
  filters: BrowseFilters;
  onChange: (next: BrowseFilters) => void;
}) {
  const update = (patch: Partial<BrowseFilters>) => onChange({ ...filters, ...patch });

  const toggleSector = (s: Sector) => {
    const has = filters.sectors.includes(s);
    update({ sectors: has ? filters.sectors.filter((x) => x !== s) : [...filters.sectors, s] });
  };
  const toggleStage = (s: StageOption) => {
    const has = filters.stages.includes(s);
    update({ stages: has ? filters.stages.filter((x) => x !== s) : [...filters.stages, s] });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <FilterDropdown
        label="Sector"
        active={filters.sectors.length > 0}
        count={filters.sectors.length}
      >
        {SECTOR_OPTIONS.map((s) => (
          <DropdownMenu.CheckboxItem
            key={s}
            checked={filters.sectors.includes(s)}
            onCheckedChange={() => toggleSector(s)}
            className="flex items-center gap-3 px-3 py-2 font-epilogue font-bold uppercase text-sm tracking-tight cursor-pointer outline-none data-[highlighted]:bg-gray-100"
          >
            <span
              className={cn(
                "w-5 h-5 border-[2px] border-black flex items-center justify-center shrink-0",
                filters.sectors.includes(s) ? "bg-secondary" : "bg-white",
              )}
            >
              {filters.sectors.includes(s) ? (
                <Icon name="check" size="sm" />
              ) : null}
            </span>
            {s}
          </DropdownMenu.CheckboxItem>
        ))}
      </FilterDropdown>

      <FilterDropdown
        label="Stage"
        active={filters.stages.length > 0}
        count={filters.stages.length}
      >
        {STAGE_OPTIONS.map((s) => (
          <DropdownMenu.CheckboxItem
            key={s.value}
            checked={filters.stages.includes(s.value)}
            onCheckedChange={() => toggleStage(s.value)}
            className="flex items-center gap-3 px-3 py-2 font-epilogue font-bold uppercase text-sm tracking-tight cursor-pointer outline-none data-[highlighted]:bg-gray-100"
          >
            <span
              className={cn(
                "w-5 h-5 border-[2px] border-black flex items-center justify-center shrink-0",
                filters.stages.includes(s.value) ? "bg-secondary" : "bg-white",
              )}
            >
              {filters.stages.includes(s.value) ? (
                <Icon name="check" size="sm" />
              ) : null}
            </span>
            {s.label}
          </DropdownMenu.CheckboxItem>
        ))}
      </FilterDropdown>

      {(filters.sectors.length > 0 || filters.stages.length > 0 || filters.query) && (
        <button
          type="button"
          onClick={() =>
            onChange({ sectors: [], stages: [], query: "", sort: filters.sort })
          }
          className="bg-white text-black font-epilogue font-black uppercase text-xs tracking-tight px-3 py-2 border-[2px] border-black shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform flex items-center gap-1.5"
        >
          <Icon name="close" size="sm" />
          Clear
        </button>
      )}

      {/* Right side — search + sort */}
      <div className="ml-auto flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-black pointer-events-none" />
          <input
            type="text"
            value={filters.query}
            onChange={(e) => update({ query: e.target.value })}
            placeholder="SEARCH PROJECTS..."
            className="pl-10 pr-4 py-2 border-[3px] border-black focus:outline-none focus:ring-0 focus:border-primary font-epilogue font-bold text-sm shadow-brutal w-56 sm:w-64 bg-white placeholder-black transition-all focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[6px_6px_0px_0px_rgba(153,69,255,1)] uppercase tracking-tight"
          />
        </div>
        <DropdownMenu.Root>
          {/* Pass-2 P1 #15: prefix with "Sort by" so the dropdown reads as a sort
              control, not another filter chip. Uses a quieter weight on the
              prefix so the active sort label still carries the visual weight. */}
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="bg-white text-black font-epilogue font-black uppercase text-sm tracking-tight px-4 py-2 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform flex items-center gap-2"
            >
              <span className="font-epilogue font-bold text-gray-500 text-xs">Sort by</span>
              <span>{SORT_LABELS[filters.sort]}</span>
              <Icon name="expand_more" size="sm" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="bg-white border-[3px] border-black shadow-brutal min-w-[180px] p-2 z-[60]"
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <DropdownMenu.Item
                  key={key}
                  onSelect={() => update({ sort: key })}
                  className={cn(
                    "px-3 py-2 font-epilogue font-bold uppercase text-sm tracking-tight cursor-pointer outline-none",
                    filters.sort === key ? "bg-primary text-white" : "data-[highlighted]:bg-gray-100",
                  )}
                >
                  {SORT_LABELS[key]}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  );
}

function FilterDropdown({
  label,
  active,
  count,
  children,
}: {
  label: string;
  active: boolean;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn(
            "font-epilogue font-black uppercase text-sm tracking-tight px-4 py-2 border-[3px] border-black shadow-brutal",
            "hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform flex items-center gap-2",
            active ? "bg-primary text-white" : "bg-white text-black",
          )}
        >
          {label}
          {active ? (
            <span className="bg-white text-black border-[2px] border-black px-1.5 text-[10px]">
              {count}
            </span>
          ) : null}
          <Icon name="expand_more" size="sm" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={8}
          className="bg-white border-[3px] border-black shadow-brutal min-w-[200px] p-2 z-[60]"
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
