import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Staynex Bookings";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

export default async function OpengraphImage() {
  const logo = await readFile(join(process.cwd(), "public/assets/logo.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "72px",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid #e7e5f2",
          borderRadius: "32px",
          background: "#ffffff",
        }}
      >
        <img
          src={logoSrc}
          alt="Staynex Bookings"
          width={760}
          height={360}
          style={{
            width: "760px",
            height: "360px",
            objectFit: "contain",
          }}
        />
      </div>
    </div>,
    { ...size },
  );
}
