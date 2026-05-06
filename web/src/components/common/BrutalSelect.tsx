"use client";

import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type BrutalSelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/**
 * Native <select> dressed in the brutal frame.
 * Used in the founder dashboard (sort) + the build form (sector/stage).
 */
export const BrutalSelect = forwardRef<HTMLSelectElement, BrutalSelectProps>(function BrutalSelect(
  { className, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        "px-4 py-3 border-[3px] border-black bg-white shadow-brutal",
        "font-epilogue font-black uppercase tracking-tight text-sm",
        "transition-all focus:outline-none",
        "focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[6px_6px_0px_0px_rgba(153,69,255,1)]",
        "brutal-select-native",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});
