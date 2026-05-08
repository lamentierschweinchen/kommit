"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { useVisaMode } from "@/lib/visa-mode";

export function Footer({ withSidebarOffset = false }: { withSidebarOffset?: boolean }) {
  const isVisa = useVisaMode();
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
        <div className="text-black">
          {isVisa ? "© 2026 Kommit · sandbox preview" : "© 2026 KOMMIT · MIT Licensed · Built on Solana"}
        </div>
        <div className="flex gap-6 font-bold">
          {!isVisa ? (
            <>
              <Link
                href="https://github.com/lamentierschweinchen/kommit"
                target="_blank"
                rel="noreferrer noopener"
                className="text-black hover:underline"
              >
                GitHub
              </Link>
              <Link href="/status" className="text-black hover:underline">
                Status
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
