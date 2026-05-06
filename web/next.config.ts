import type { NextConfig } from "next";

/**
 * Per Codex finding M5: baseline security headers on every response.
 * Full CSP is deferred — Privy's modal + the Solana web3 stack pull a wide
 * connect-src/script-src surface, and a strict CSP would need bake-in time
 * to avoid breaking sign-in. Re-visit pre-public deploy.
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
] as const;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "i.pravatar.cc" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS.map((h) => ({ key: h.key, value: h.value })),
      },
    ];
  },
};

export default nextConfig;
