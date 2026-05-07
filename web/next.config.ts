import type { NextConfig } from "next";

/**
 * Codex M5 (Layer-9 partial-close → full close on this commit):
 *
 * Baseline non-CSP headers (X-Content-Type-Options, Referrer-Policy,
 * X-Frame-Options, Permissions-Policy) shipped in the previous Pass-2 pass.
 * This commit adds Content-Security-Policy + an explicit `frame-ancestors 'none'`
 * directive, deployed in **REPORT-ONLY** mode initially so a typo or a
 * missed third-party origin can't break the live deploy.
 *
 * --- Rollout ---
 * 1. SHIP: Content-Security-Policy-Report-Only (this commit).
 * 2. WALK: sign-in, kommit, withdraw on Vercel preview + production. Watch
 *    the browser console for "Refused to ..." CSP violations.
 * 3. PATCH: add any legitimately-missing source(s) to the directive below.
 * 4. ENFORCE: rename the header from `Content-Security-Policy-Report-Only`
 *    to `Content-Security-Policy` once a full walk produces zero violations.
 *
 * --- Directive rationale ---
 * - 'self'                                  own origin (Vercel domain)
 * - https://*.privy.io                      Privy auth backend + iframe
 * - https://*.privy.systems                 Privy embedded UI alt origin
 * - wss://*.privy.io                        Privy realtime
 * - https://*.walletconnect.com / .org      External-wallet connector flow
 *                                            (toSolanaWalletConnectors in
 *                                            providers.tsx); WC uses the
 *                                            verify-frame + relay
 * - wss://*.walletconnect.com / .org        WC relay sockets
 * - https://*.helius-rpc.com                Solana RPC (NEXT_PUBLIC_HELIUS_RPC_URL)
 * - https://api.devnet.solana.com           Solana RPC fallback
 * - https://*.supabase.co + wss://...       Supabase REST + Realtime
 *                                            (anon-only reads; no service role)
 * - https://fonts.googleapis.com            Google Fonts CSS (Material Symbols
 *                                            via globals.css @import)
 * - https://fonts.gstatic.com               Google Fonts woff2 binaries
 * - https://picsum.photos / i.pravatar.cc   Demo seed images (matches
 *                                            next.config images.remotePatterns)
 * - 'unsafe-inline' (style-src)             Tailwind generates inline style
 *                                            attributes; switching to a nonce
 *                                            strategy is post-launch homework
 * - 'unsafe-inline' + 'unsafe-eval' (script-src)
 *                                           Next.js dev/prod client runtime;
 *                                           Privy SDK uses dynamic Function
 *                                           constructors. Documented Privy
 *                                           requirement.
 * - frame-ancestors 'none'                  Same intent as X-Frame-Options DENY
 *                                           but explicit per Codex spec; modern
 *                                           browsers prefer this directive.
 */
const CSP_DIRECTIVES = [
  "default-src 'self'",
  [
    "script-src",
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    "https://*.privy.io",
    "https://*.privy.systems",
  ].join(" "),
  [
    "style-src",
    "'self'",
    "'unsafe-inline'",
    "https://fonts.googleapis.com",
  ].join(" "),
  ["font-src", "'self'", "data:", "https://fonts.gstatic.com"].join(" "),
  [
    "img-src",
    "'self'",
    "data:",
    "blob:",
    "https://*.privy.io",
    "https://*.privy.systems",
    "https://*.walletconnect.com",
    "https://picsum.photos",
    "https://i.pravatar.cc",
    "https://fastly.picsum.photos",
  ].join(" "),
  [
    "connect-src",
    "'self'",
    "https://*.privy.io",
    "https://*.privy.systems",
    "wss://*.privy.io",
    "https://*.walletconnect.com",
    "https://*.walletconnect.org",
    "wss://*.walletconnect.com",
    "wss://*.walletconnect.org",
    "https://*.helius-rpc.com",
    "https://api.devnet.solana.com",
    "https://*.supabase.co",
    "wss://*.supabase.co",
  ].join(" "),
  [
    "frame-src",
    "'self'",
    "https://*.privy.io",
    "https://*.privy.systems",
    "https://verify.walletconnect.com",
    "https://verify.walletconnect.org",
  ].join(" "),
  "frame-ancestors 'none'",
  "worker-src 'self' blob:",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // REPORT-ONLY during Pass-2 rollout. Promote to `Content-Security-Policy`
  // once a full sign-in/kommit/withdraw walk on the Vercel preview produces
  // zero "Refused to..." violations in the browser console.
  { key: "Content-Security-Policy-Report-Only", value: CSP_DIRECTIVES },
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
