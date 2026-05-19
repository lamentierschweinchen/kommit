"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";

export function Footer({ withSidebarOffset = false }: { withSidebarOffset?: boolean }) {
  return (
    <footer
      className={cn(
        "border-t-[3px] border-black bg-white px-6 md:px-12 py-6",
        withSidebarOffset && "lg:ml-64",
      )}
    >
      <div
        className={cn(
          "flex flex-col sm:flex-row justify-between items-center gap-4",
          "font-epilogue font-medium text-xs uppercase tracking-tight",
          !withSidebarOffset && "max-w-7xl mx-auto",
        )}
      >
        <div className="text-black">© 2026 KOMMIT · Open source · Built on Solana</div>
        {/* Handoff 78 P1-1 / wave 6: GitHub/Status were 43×16 inline text
            links — far below the 44pt iOS minimum. `min-h-[44px] py-3`
            promotes them to real tap targets without changing the brutalist
            inline-link look. */}
        <div className="flex gap-6 font-bold">
          <Link
            href="https://github.com/lamentierschweinchen/kommit"
            target="_blank"
            rel="noreferrer noopener"
            className="text-black hover:underline inline-flex items-center min-h-[44px] py-3"
          >
            GitHub
          </Link>
          <Link
            href="/status"
            className="text-black hover:underline inline-flex items-center min-h-[44px] py-3"
          >
            Status
          </Link>
        </div>
      </div>
    </footer>
  );
}
