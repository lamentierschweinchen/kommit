import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "border-[3px] border-black bg-gray-100 animate-pulse",
        "shadow-brutal",
        className,
      )}
    />
  );
}

export function SkeletonInline({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block border-[2px] border-black bg-gray-100 animate-pulse",
        "h-4 w-20",
        className,
      )}
    />
  );
}
