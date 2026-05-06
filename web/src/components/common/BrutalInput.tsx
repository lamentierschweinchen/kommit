"use client";

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type BrutalInputProps = InputHTMLAttributes<HTMLInputElement>;

export const BrutalInput = forwardRef<HTMLInputElement, BrutalInputProps>(function BrutalInput(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full px-4 py-3 border-[3px] border-black bg-white shadow-brutal",
        "font-medium text-base placeholder-gray-400",
        "transition-all focus:outline-none",
        "focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[6px_6px_0px_0px_rgba(153,69,255,1)]",
        className,
      )}
      {...props}
    />
  );
});

export type BrutalTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const BrutalTextarea = forwardRef<HTMLTextAreaElement, BrutalTextareaProps>(
  function BrutalTextarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full p-5 border-[3px] border-black bg-white shadow-brutal",
          "font-medium text-base leading-relaxed placeholder-gray-400 resize-y",
          "transition-all focus:outline-none",
          "focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[6px_6px_0px_0px_rgba(153,69,255,1)]",
          className,
        )}
        {...props}
      />
    );
  },
);
