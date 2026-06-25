import { ImageResponse } from "next/og";

export const alt = "Staynex — Book trusted stays, Confidently.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Generated OG image (no external asset needed). Brand color + tagline.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #27187D 0%, #1a1052 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 34, letterSpacing: 4, opacity: 0.8, textTransform: "uppercase" }}>
          Staynex
        </div>
        <div style={{ fontSize: 84, fontWeight: 700, marginTop: 24, lineHeight: 1.05 }}>
          Book trusted stays,
        </div>
        <div style={{ fontSize: 84, fontWeight: 700, color: "#C7BFF0", lineHeight: 1.05 }}>
          Confidently.
        </div>
        <div style={{ fontSize: 30, opacity: 0.85, marginTop: 40 }}>
          Verified properties · Secure Paystack payments · Real-time availability
        </div>
      </div>
    ),
    { ...size },
  );
}
