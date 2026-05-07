"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BrutalButtonVariant =
  | "primary" // purple — main commits, sign-in
  | "secondary" // green — landing CTAs ("Browse projects")
  | "outline" // white with black border — neutral
  | "destructive" // black with green-shadow accent — withdraw, show-key (per audit #11)
  | "ghost-link"; // no fill; underlined link

export type BrutalButtonSize = "xs" | "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<BrutalButtonVariant, string> = {
  primary:
    "bg-primary text-white border-black shadow-brutal hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]",
  secondary:
    "bg-secondary text-black border-black shadow-brutal hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]",
  outline:
    "bg-white text-black border-black shadow-brutal hover:bg-gray-100 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]",
  destructive:
    "bg-black text-white border-black shadow-[6px_6px_0px_0px_rgba(20,241,149,1)] hover:shadow-[8px_8px_0px_0px_rgba(20,241,149,1)]",
  "ghost-link":
    "bg-transparent text-black border-transparent shadow-none underline underline-offset-4 hover:bg-gray-100",
};

const SIZE_CLASSES: Record<BrutalButtonSize, string> = {
  xs: "text-xs px-3 py-2 border-[2px] gap-1.5",
  sm: "text-sm px-4 py-2 border-[3px] gap-2",
  md: "text-base px-6 py-3 border-[3px] gap-2",
  lg: "text-base md:text-lg px-8 py-4 border-[3px] gap-3",
};

export type BrutalButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BrutalButtonVariant;
  size?: BrutalButtonSize;
  /** Icon glyph (Material Symbols name) rendered before children */
  iconLeft?: ReactNode;
  /** Icon glyph rendered after children */
  iconRight?: ReactNode;
  fullWidth?: boolean;
};

export const BrutalButton = forwardRef<HTMLButtonElement, BrutalButtonProps>(function BrutalButton(
  {
    variant = "primary",
    size = "md",
    iconLeft,
    iconRight,
    fullWidth,
    className,
    children,
    type = "button",
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center font-epilogue font-black uppercase tracking-tight",
        "transition-transform hover:translate-x-[-2px] hover:translate-y-[-2px]",
        "active:translate-x-[2px] active:translate-y-[2px]",
        // Pass-2 P1 #11: disabled visual is demoted — no offset shadow, grey
        // border, lower fill opacity. Stops disabled buttons from reading as
        // pressable.
        "disabled:opacity-50 disabled:pointer-events-none",
        "disabled:shadow-none disabled:!border-gray-300",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
});
