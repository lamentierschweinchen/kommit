"use client";

/**
 * Lane B sandbox banner. Sticky at the top of `/sandbox/*`. Tells judges
 * the surface is devnet + that on-chain calls are real, with a Solscan
 * jump-off for context. Subtle styling — doesn't compete with the page
 * content underneath.
 */

import Link from "next/link";

export function SandboxBanner() {
  return (
    <div className="border-b-[3px] border-black bg-secondary">
      <div className="max-w-6xl mx-auto px-6 md:px-12 py-2.5 flex items-center justify-between gap-4 flex-wrap">
        <span className="font-epilogue font-black uppercase text-[10px] tracking-widest text-black">
          Sandbox · Devnet · Real on-chain calls
        </span>
        <Link
          href="https://solscan.io/?cluster=devnet"
          target="_blank"
          rel="noopener noreferrer"
          className="font-epilogue font-bold uppercase text-[10px] tracking-widest text-black/70 hover:text-black underline decoration-2 underline-offset-2"
        >
          Solscan ↗
        </Link>
      </div>
    </div>
  );
}
