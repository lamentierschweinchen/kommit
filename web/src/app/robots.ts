import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://kommit.now");

/**
 * Lane A architecture:
 *   - `/`     coming-soon waitlist (allow + index)
 *   - `/app`  functional product landing (allow + index)
 *   - `/sandbox/*` Lane B's judge-facing on-chain demo — disallow until Lane B
 *                   ships, then a follow-up PR can flip this on if we want it
 *                   indexed (probably not — judge surface, not marketing)
 *   - `/demo`  Lane C mock recording surface — disallow always
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/app", "/projects", "/projects/", "/about", "/build", "/build/submitted", "/status"],
        // Authed surfaces gate themselves with <AuthGate>, but we still ask
        // crawlers not to bother — the rendered shell shows the gate, not
        // anything indexable. Keeps Google from caching the gate page.
        // /demo and /sandbox/* are explicitly excluded per Lane A rollout.
        disallow: ["/dashboard", "/account", "/founder/", "/demo", "/sandbox/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
