"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

/**
 * Mounts <Providers> client-side only.
 *
 * PrivyProvider initialises against `window` and rejects placeholder
 * app IDs at construction time. That breaks Next.js static prerendering
 * of `/_not-found` and any other route that runs through SSG.
 *
 * Wrapping the Providers component in `dynamic({ ssr: false })` keeps
 * the server render to a minimal shell; client hydration loads Privy +
 * the Solana connection context. Brief flash on first paint is
 * acceptable for v1.
 *
 * Pattern lifted from web-legacy-anchor-ref/src/components/providers-mount.tsx.
 */
const Providers = dynamic(
  () => import("@/components/providers").then((m) => m.Providers),
  { ssr: false },
);

export function ProvidersMount({ children }: { children: ReactNode }) {
  return <Providers>{children}</Providers>;
}
