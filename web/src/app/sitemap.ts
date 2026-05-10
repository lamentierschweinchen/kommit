import type { MetadataRoute } from "next";
import { PROJECTS } from "@/lib/data/projects";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://kommit.now");

/**
 * Sitemap covers public surfaces only. Authed routes (`/dashboard`, `/account`,
 * `/founder/*`) are not indexed — they render the auth gate to anonymous
 * crawlers and that's not useful in search results.
 *
 * Lane A architecture: `/` is the coming-soon waitlist (high priority for
 * discovery), `/app` is the functional landing. `/sandbox/*` is the Lane B
 * judge surface — disallowed in robots.ts and intentionally excluded from
 * the sitemap (judge-facing only, not marketing-indexable). `/demo` is
 * also excluded — mock-only recording surface (Lane C).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE_URL}/app`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/projects`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/manifesto`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/build`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/status`, lastModified: now, changeFrequency: "weekly", priority: 0.4 },
  ];

  const projectRoutes: MetadataRoute.Sitemap = PROJECTS.map((p) => ({
    url: `${SITE_URL}/projects/${p.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: p.state === "graduated" ? 0.7 : 0.8,
  }));

  return [...staticRoutes, ...projectRoutes];
}
