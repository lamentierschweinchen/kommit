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
 */

import { useEffect, type ReactNode } from "react";

import { AuthHeader } from "@/components/layout/AuthHeader";
import { Footer } from "@/components/layout/Footer";
import { isDemoMode, deactivateDemoMode } from "@/lib/demo-mode";
import { SandboxBanner } from "@/components/sandbox/SandboxBanner";

export default function SandboxLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isDemoMode()) {
      deactivateDemoMode();
      window.location.reload();
    }
  }, []);

  return (
    <>
      <AuthHeader homeHref="/app" />
      <SandboxBanner />
      <main className="flex-1 bg-[#FFFCF5]">{children}</main>
      <Footer />
    </>
  );
}
