"use client";

/**
 * Lane B `/sandbox/*` layout.
 *
 * Belt-and-suspenders defensive guard: if a judge somehow lands here with
 * demo-mode active (e.g. they wandered in from `/demo`), tear demo-mode
 * down and reload. /sandbox is the real-Privy surface — leaving the
 * Lukas persona pinned would let simulated commits land under the wrong
 * wallet and make the dashboard read path inconsistent.
 *
 * Wordmark in <AuthHeader> routes to `/app` (the live product home),
 * matching the URL move from Lane A. The marketing waitlist at `/` is
 * not a useful destination from a judge surface.
 *
 * Codex Pass 1 M2: only reload after we've confirmed the localStorage flag
 * actually flipped. When `NEXT_PUBLIC_KOMMIT_DEMO=1` is env-forced,
 * `deactivateDemoMode()` clears the storage flag but `isDemoMode()` still
 * returns true on the next read — without this guard we'd reload forever.
 */

import { useEffect, useState, type ReactNode } from "react";

import { AuthHeader } from "@/components/layout/AuthHeader";
import { Footer } from "@/components/layout/Footer";
import { isDemoMode, deactivateDemoMode } from "@/lib/demo-mode";
import { SandboxBanner } from "@/components/sandbox/SandboxBanner";

export default function SandboxLayout({ children }: { children: ReactNode }) {
  const [envForcedDemo, setEnvForcedDemo] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isDemoMode()) return;
    deactivateDemoMode();
    // Re-check synchronously: if the flag is still on, the env var
    // (NEXT_PUBLIC_KOMMIT_DEMO=1) is forcing it and reloading would loop.
    if (isDemoMode()) {
      setEnvForcedDemo(true);
      return;
    }
    window.location.reload();
  }, []);

  if (envForcedDemo) {
    return (
      <>
        <AuthHeader homeHref="/app" />
        <main className="flex-1 bg-[#FFFCF5] flex items-center justify-center px-6 py-24">
          <div className="max-w-xl text-center border-[3px] border-black bg-white shadow-brutal p-8">
            <h1 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter">
              Sandbox unavailable
            </h1>
            <p className="mt-4 font-epilogue text-sm md:text-base text-gray-700 leading-relaxed">
              The sandbox is the real-Privy surface and can&apos;t run while
              demo mode is forced on by environment. Unset{" "}
              <code className="bg-gray-100 border border-gray-300 px-1.5 py-0.5 text-xs">
                NEXT_PUBLIC_KOMMIT_DEMO
              </code>{" "}
              and reload to use the sandbox.
            </p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <AuthHeader homeHref="/app" />
      <SandboxBanner />
      <main className="flex-1 bg-[#FFFCF5]">{children}</main>
      <Footer />
    </>
  );
}
