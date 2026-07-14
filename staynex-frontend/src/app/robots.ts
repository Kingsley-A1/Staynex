import type { MetadataRoute } from "next";
import { getSiteOrigin } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const isPreview = process.env.VERCEL_ENV === "preview";
  const site = getSiteOrigin();

  return {
    rules: isPreview
      ? [{ userAgent: "*", disallow: "/" }]
      : [
          {
            userAgent: "*",
            allow: "/",
            disallow: [
              "/admin/",
              "/host/",
              "/checkout",
              "/profile",
              "/settings",
              "/payment/status",
              "/booking/confirmed",
              "/reset-password",
              "/admin-access",
            ],
          },
        ],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
