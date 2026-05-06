import { cn } from "@/lib/cn";

export type TapeColor = "primary" | "secondary" | "black" | "white";
export type TapeSize = "sm" | "md" | "lg";

const COLOR_CLASSES: Record<TapeColor, string> = {
  primary: "bg-primary border-[2px] border-black",
  secondary: "bg-secondary border-[2px] border-black",
  black: "bg-black",
  white: "bg-white border-[2px] border-black",
};

const SIZE_CLASSES: Record<TapeSize, string> = {
  sm: "w-12 h-4",
  md: "w-20 h-6",
  lg: "w-24 h-7",
};

/**
 * Tape decoration — STATE INDICATORS ONLY (audit fix #16).
 * Use only on: Pivoted, Graduated, Just listed, New round invite, destructive modal.
 * Do NOT use as decorative chrome.
 */
export function Tape({
  color = "primary",
  size = "md",
  rotation = -6,
  className,
}: {
  color?: TapeColor;
  size?: TapeSize;
  rotation?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      style={{ transform: `rotate(${rotation}deg)` }}
      className={cn(COLOR_CLASSES[color], SIZE_CLASSES[size], "inline-block", className)}
    />
  );
}

/**
 * StatePill — replacement for decorative tapes (audit #16 demote).
 * Used for "THE CONVICTION PRIMITIVE" hero label, etc. — informational chip,
 * no rotation, no tape framing.
 */
export function StatePill({
  children,
  color = "secondary",
  className,
}: {
  children: React.ReactNode;
  color?: "primary" | "secondary" | "black" | "white";
  className?: string;
}) {
  const colorMap: Record<string, string> = {
    primary: "bg-primary text-white",
    secondary: "bg-secondary text-black",
    black: "bg-black text-white",
    white: "bg-white text-black",
  };
  return (
    <span
      className={cn(
        "inline-block font-epilogue font-black uppercase text-xs px-3 py-1 border-[2px] border-black",
        "shadow-brutal-sm tracking-tight",
        colorMap[color],
        className,
      )}
    >
      {children}
    </span>
  );
}
