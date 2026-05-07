import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://kommit.now");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/projects", "/projects/", "/about", "/build", "/build/submitted", "/status"],
        // Authed surfaces gate themselves with <AuthGate>, but we still ask
        // crawlers not to bother — the rendered shell shows the gate, not
        // anything indexable. Keeps Google from caching the gate page.
        disallow: ["/dashboard", "/account", "/founder/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
