import type { MetadataRoute } from "next";
import { PUBLIC_SITEMAP_ROUTES, absoluteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return PUBLIC_SITEMAP_ROUTES.map((route) => ({
    url: absoluteUrl(route),
    lastModified: now,
    changeFrequency: route === "/" || route === "/search" ? "daily" : "monthly",
    priority: route === "/" ? 1 : route === "/search" ? 0.9 : 0.7,
  }));
}
