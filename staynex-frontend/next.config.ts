import type { NextConfig } from "next";

const apiOrigin = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
).replace(/\/+$/, "");
const production = process.env.NODE_ENV === "production";

// Public base of the media bucket (R2 custom domain or dev subdomain). Drives
// the next/image optimizer allowlist — uploaded photos are served resized and
// re-encoded (AVIF/WebP) instead of full-size originals.
function mediaRemotePattern(): {
  protocol: "https" | "http";
  hostname: string;
} | null {
  const base = process.env.NEXT_PUBLIC_MEDIA_BASE_URL;
  if (!base) return null;
  try {
    const url = new URL(base);
    return {
      protocol: url.protocol === "http:" ? "http" : "https",
      hostname: url.hostname,
    };
  } catch {
    return null;
  }
}
const mediaPattern = mediaRemotePattern();
const mediaUploadOrigin = (() => {
  const configured = process.env.NEXT_PUBLIC_MEDIA_UPLOAD_ORIGIN?.trim();
  if (!configured) return "https://*.r2.cloudflarestorage.com";
  try {
    const url = new URL(configured);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.origin
      : null;
  } catch {
    return null;
  }
})();

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https://checkout.paystack.com",
  `img-src 'self' data: blob: https: ${apiOrigin}`,
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://va.vercel-scripts.com https://www.gstatic.com",
  `connect-src 'self' ${apiOrigin}${mediaUploadOrigin ? ` ${mediaUploadOrigin}` : ""} https://accounts.google.com https://vitals.vercel-insights.com https://*.vercel-insights.com https://fcmregistrations.googleapis.com https://firebaseinstallations.googleapis.com https://fcm.googleapis.com https://www.googleapis.com`,
  "frame-src https://accounts.google.com",
  "worker-src 'self' blob:",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Required for the forbidden() gate in lib/server-authorization.ts —
    // without it forbidden() throws at runtime (500) instead of rendering
    // app/forbidden.tsx for signed-in users who lack the capability.
    authInterrupts: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // A small allowlist keeps the optimizer cache bounded. Guest galleries use
    // 88 to avoid visible double-compression after host-side upload encoding;
    // cards use 82 and workspace thumbnails stay at 75.
    qualities: [75, 82, 88],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: mediaPattern ? [mediaPattern] : [],
  },
  async redirects() {
    // The host workspace moved from /owner/* — keep old links and bookmarks alive.
    return [
      {
        source: "/owner/:path*",
        destination: "/host/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/assets/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=2592000, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          ...(production
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains; preload",
                },
              ]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
