import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION, SITE_NAME, SITE_PARENT, SITE_PRODUCT_LINE } from "@/lib/site";

export const runtime = "nodejs";
export const alt = `${SITE_NAME} — ${SITE_PRODUCT_LINE} by ${SITE_PARENT}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const logo = await readFile(join(process.cwd(), "public", "tagx-logo.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #07343c 0%, #0f6e7a 55%, #5a9a2f 100%)",
          color: "white",
          padding: "64px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "white",
            borderRadius: 16,
            padding: "16px 24px",
            width: 420,
          }}
        >
          <img src={logoSrc} alt="" width={372} height={149} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 28, letterSpacing: 6, textTransform: "uppercase", opacity: 0.9 }}>
            {SITE_PRODUCT_LINE}
          </div>
          <div style={{ fontSize: 28, maxWidth: 820, lineHeight: 1.35, opacity: 0.95 }}>{SITE_DESCRIPTION}</div>
        </div>
        <div style={{ display: "flex", fontSize: 24, opacity: 0.9 }}>A {SITE_PARENT} product</div>
      </div>
    ),
    { ...size },
  );
}
