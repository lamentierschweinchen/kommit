"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { activateRecordingMode, deactivateRecordingMode } from "@/lib/demo-mode";

/**
 * Reads the `?recording=1` query param on mount and flips the recording-mode
 * localStorage flag, then strips the query so the URL stays clean for the
 * camera. `?recording=0` deactivates (escape hatch if Lukas needs to recover
 * mid-take without DevTools).
 *
 * Mounted once at the root layout so it fires on any entry path. Self-
 * contained — renders nothing.
 */
export function RecordingActivator() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const value = searchParams?.get("recording");
    if (value !== "1" && value !== "0") return;
    if (value === "1") activateRecordingMode();
    else deactivateRecordingMode();
    // Strip the query so the URL bar doesn't show `?recording=1` on camera.
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    next.delete("recording");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [searchParams, pathname, router]);

  return null;
}
