"use client";

/**
 * Lane B sandbox banner. Sticky at the top of `/sandbox/*`. Frames the
 * scope of the sandbox — funded on devnet, real on-chain calls — and
 * tells visitors that browsing the rest of kommit.now is fine. Without
 * this framing, links to /dashboard or /projects from the sandbox can
 * read as "still inside the sandbox," which they aren't. Subtle styling
 * so it doesn't compete with the page content underneath.
 */

import Link from "next/link";

export function SandboxBanner() {
  return (
    <div className="border-b-[3px] border-black bg-secondary">
      <div className="max-w-6xl mx-auto px-6 md:px-12 py-2.5 flex items-center justify-between gap-4 flex-wrap">
        <span className="font-epilogue font-bold uppercase text-[10px] tracking-widest text-black leading-snug">
          <span className="font-black">Sandbox</span> · Real on-chain devnet
          activity. Browse the rest of kommit.now freely — settlement
          happens on devnet only.
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
