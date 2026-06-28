import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Staynex",
    short_name: "Staynex",
    description:
      "Verified stays, secure payments, and real-time availability across Nigeria.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f7ff",
    theme_color: "#27187d",
    icons: [
      { src: "/icon.png", sizes: "256x256", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
