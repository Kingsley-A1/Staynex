import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Suspense } from "react";
import "../styles/globals.css";
import { PageLoadingLine } from "@/components/page-loading-line";
import { WebVitalsReporter } from "@/components/web-vitals-reporter";
import {
  DEFAULT_DESCRIPTION,
  SEO_KEYWORDS,
  SITE_NAME,
  getSiteOrigin,
  getSiteUrl,
} from "@/lib/seo";

const appUrl = getSiteUrl();
const appOrigin = getSiteOrigin();

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "TravelAgency",
  name: SITE_NAME,
  url: appOrigin,
  logo: `${appOrigin}/assets/logo-main.png`,
  areaServed: "Nigeria",
  slogan: "Book trusted stays, confidently.",
  contactPoint: {
    "@type": "ContactPoint",
    email: "support@staynexbookings.ng",
    contactType: "customer support",
  },
};

export const metadata: Metadata = {
  metadataBase: appUrl,
  title: {
    default: "Staynex | Verified stays and secure bookings in Nigeria",
    template: "%s · Staynex",
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: SEO_KEYWORDS,
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "travel",
  manifest: "/manifest.webmanifest",
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "256x256" },
    ],
    shortcut: ["/favicon.ico"],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
  },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: appOrigin,
    title: "Staynex | Book trusted stays, confidently",
    description: DEFAULT_DESCRIPTION,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Staynex verified stays and secure bookings",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Staynex | Book Trusted Stays, Confidently",
    description: DEFAULT_DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={null}>
          <PageLoadingLine />
          <WebVitalsReporter />
          <Analytics />
        </Suspense>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd).replace(/</g, "\\u003c"),
          }}
        />
        {children}
      </body>
    </html>
  );
}
