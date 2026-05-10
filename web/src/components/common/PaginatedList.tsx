"use client";

import { useState } from "react";
import { Icon } from "@/components/common/Icon";
import { cn } from "@/lib/cn";

/**
 * Last-N-by-default list with a single expand affordance — mirrors the
 * "Recent updates" treatment used elsewhere in the app. Renders nothing
 * extra when the list is at-or-below `defaultLimit`.
 */
export function PaginatedList<T>({
  items,
  renderItem,
  defaultLimit = 10,
  expandLabel,
  collapseLabel = "Show less",
  itemKey,
  emptyState,
  containerClassName,
}: {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  defaultLimit?: number;
  /** Custom label for the "show all" button. Defaults to `Show all (N)`. */
  expandLabel?: (hidden: number, total: number) => string;
  collapseLabel?: string;
  itemKey?: (item: T, index: number) => string;
  emptyState?: React.ReactNode;
  containerClassName?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) {
    return emptyState ? <>{emptyState}</> : null;
  }

  const visible = expanded ? items : items.slice(0, defaultLimit);
  const hidden = items.length - defaultLimit;
  const showToggle = items.length > defaultLimit;
  const labelExpand =
    expandLabel?.(hidden, items.length) ?? `Show all (${items.length})`;

  return (
    <div className={cn("space-y-3", containerClassName)}>
      <ul className="space-y-2">
        {visible.map((item, i) => (
          <li key={itemKey ? itemKey(item, i) : i}>{renderItem(item, i)}</li>
        ))}
      </ul>
      {showToggle ? (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="inline-flex items-center gap-1.5 font-epilogue font-bold uppercase tracking-widest text-[11px] text-gray-600 hover:text-black"
        >
          {expanded ? collapseLabel : labelExpand}
          <Icon
            name="expand_more"
            size="sm"
            className={cn("transition-transform", expanded ? "rotate-180" : "")}
          />
        </button>
      ) : null}
    </div>
  );
}
