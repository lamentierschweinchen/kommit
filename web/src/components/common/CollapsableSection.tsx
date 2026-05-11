"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/common/Icon";

/**
 * Brutalist collapsable section header. Used on /projects/[slug] (handoff 69
 * B12) to keep the long-form sections (Updates / Roadmap / Kommit notes /
 * Recent kommitters) navigable without crowding the page.
 *
 * The header carries the same h2 treatment the page already uses
 * (font-epilogue font-black + border-b-[4px] underline) plus a chevron that
 * rotates when open. Optional `hint` shows a count or short tag when
 * collapsed ("4 notes", "62 kommitters") so users get a content preview
 * before deciding to expand.
 */
export function CollapsableSection({
  id,
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  id?: string;
  title: string;
  /** Short text shown next to the chevron when collapsed — e.g. "4 notes". */
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section id={id}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="group w-full mb-8 flex items-center gap-3 flex-wrap text-left"
      >
        <h2 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex items-center gap-2 max-w-fit group-hover:text-primary transition-colors">
          {title}
          <Icon
            name="expand_more"
            size="md"
            className={cn(
              "transition-transform shrink-0",
              open ? "rotate-180" : "",
            )}
          />
        </h2>
        {!open && hint ? (
          <span className="font-epilogue font-bold uppercase text-[11px] tracking-widest text-gray-500">
            {hint}
          </span>
        ) : null}
      </button>
      {open ? children : null}
    </section>
  );
}
