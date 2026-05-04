"use client";

import dynamic from "next/dynamic";

// Mounts the Providers tree client-side only. PrivyProvider rejects
// placeholder app IDs at init, which would break SSG of /_not-found and
// any other static page. Server renders a minimal shell; client hydration
// loads Privy + the Solana connection context. Brief flash on first paint
// is acceptable for v1; revisit when a real app ID lives in `.env.local`.
const Providers = dynamic(
  () => import("@/components/providers").then((m) => m.Providers),
  { ssr: false }
);

export function ProvidersMount({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
