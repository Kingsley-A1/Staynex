import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Suspense } from "react";
import "../styles/globals.css";

// Brand wordmark typeface — geometric, premium, and the closest web match to the
// "Staynex" lettering in the logo. Exposed as --font-brand-src for the
// `font-brand` utility (see tokens.css); the rest of the UI stays system-first.
const brandFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-brand-src",
  display: "swap",
});
import { PageLoadingLine } from "@/components/page-loading-line";
import { WebVitalsReporter } from "@/components/web-vitals-reporter";
import { OfflineServiceWorker } from "@/components/offline-service-worker";
import { DeferredAssistantWidget } from "@/features/ai/deferred-assistant-widget";
import {
  DEFAULT_DESCRIPTION,
  SEO_KEYWORDS,
  SITE_NAME,
  getSiteOrigin,
  getSiteUrl,
} from "@/lib/seo";
import { getSupportContactFromEnv } from "@/lib/support-contact";

const appUrl = getSiteUrl();
const appOrigin = getSiteOrigin();
const supportContact = getSupportContactFromEnv();

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
    ...(supportContact.email ? { email: supportContact.email } : {}),
    ...(supportContact.phone ? { telephone: supportContact.phone } : {}),
    contactType: "customer support",
  },
};

export const metadata: Metadata = {
  metadataBase: appUrl,
  title: {
    default: "Staynex Bookings | Verified stays and secure bookings in Nigeria",
    template: "%s · Staynex Bookings",
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
    title: "Staynex Bookings | Book trusted stays, confidently",
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
    title: "Staynex Bookings | Book Trusted Stays, Confidently",
    description: DEFAULT_DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={brandFont.variable}>
      <body>
        <Suspense fallback={null}>
          <PageLoadingLine />
          <WebVitalsReporter />
          <OfflineServiceWorker />
          <Analytics />
        </Suspense>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd).replace(/</g, "\\u003c"),
          }}
        />
        <div id="staynex-app-shell">{children}</div>
        <DeferredAssistantWidget />
      </body>
    </html>
  );
}
