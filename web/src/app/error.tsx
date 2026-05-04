"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to console — sonner toasts don't reach here, the providers tree
    // is upstream. The render fallback below is what the user sees.
    console.error("Page error:", error);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-20 text-center">
      <h1 className="text-3xl md:text-4xl font-medium tracking-tight">Something went wrong</h1>
      <p className="mt-3 text-muted-foreground">
        {error.message || "An unexpected error occurred."}
      </p>
      {error.digest && (
        <p className="mt-1 text-xs text-muted-foreground font-mono">digest: {error.digest}</p>
      )}
      <div className="mt-6 flex items-center justify-center gap-2">
        <Button onClick={reset} variant="outline">
          Try again
        </Button>
        <Button asChild>
          <Link href="/projects">Browse projects</Link>
        </Button>
      </div>
    </div>
  );
}
