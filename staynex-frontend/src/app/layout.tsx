import type { Metadata } from "next";
import "../styles/globals.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const description =
  "Book trusted stays, Confidently. Verified properties, secure Paystack payments, and real-time availability across Nigeria and beyond.";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Staynex — Book trusted stays, Confidently.",
    template: "%s · Staynex",
  },
  description,
  applicationName: "Staynex",
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
    siteName: "Staynex",
    url: appUrl,
    title: "Staynex — Book trusted stays, Confidently.",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "Staynex — Book trusted stays, Confidently.",
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
