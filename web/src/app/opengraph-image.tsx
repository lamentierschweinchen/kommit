import { ImageResponse } from "next/og";

/**
 * Default Open Graph image for the site root.
 *
 * Next 15 picks up this file as `/opengraph-image` and serves the rendered
 * 1200×630 image at build (or per-request, depending on host). Subroutes
 * inherit this unless they expose their own `opengraph-image.tsx`.
 *
 * Brand-coded but font-system-safe: the brutalist composition is what reads,
 * not a specific typeface. Bricolage Grotesque is the canonical brand font;
 * a future revision can fetch its binary at build time and pass to
 * ImageResponse.fonts. For now system sans is fine — composition and
 * colour carry the brand recognition.
 */

export const runtime = "edge";
export const alt = "Kommit — Turn conviction into currency.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#ffffff",
          padding: 64,
          position: "relative",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Brand row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span
            style={{
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "#000",
              textTransform: "lowercase",
            }}
          >
            kommit
          </span>
          <span
            style={{
              fontSize: 28,
              color: "#9945FF",
              fontWeight: 800,
            }}
          >
            *
          </span>
        </div>

        {/* Headline — sits in a brutal black box with a purple offset shadow,
            mirroring the landing hero's rotating-word treatment. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 36,
            gap: 32,
            flexGrow: 1,
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontSize: 86,
              fontWeight: 900,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              color: "#000",
              textTransform: "uppercase",
              maxWidth: 980,
            }}
          >
            Turn
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
            }}
          >
            <div
              style={{
                position: "relative",
                background: "#000",
                color: "#fff",
                fontSize: 110,
                fontWeight: 900,
                letterSpacing: "-0.03em",
                lineHeight: 1,
                padding: "16px 28px",
                border: "4px solid #000",
                textTransform: "uppercase",
                boxShadow: "12px 12px 0px 0px #9945FF",
                transform: "rotate(-1.5deg)",
              }}
            >
              conviction
            </div>
          </div>
          <div
            style={{
              fontSize: 86,
              fontWeight: 900,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              color: "#000",
              textTransform: "uppercase",
            }}
          >
            into currency.
          </div>
        </div>

        {/* Footer subhead with brutal left border, matches the landing subhead */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginTop: 28,
          }}
        >
          <div
            style={{
              width: 6,
              height: 64,
              background: "#9945FF",
            }}
          />
          <div
            style={{
              fontSize: 28,
              fontWeight: 600,
              fontStyle: "italic",
              color: "#3f3f46",
              maxWidth: 900,
              lineHeight: 1.35,
            }}
          >
            Back early-stage projects without locking your money.
          </div>
        </div>

        {/* Bottom-right green tape decoration, on-brand */}
        <div
          style={{
            position: "absolute",
            bottom: 36,
            right: 56,
            width: 96,
            height: 28,
            background: "#14F195",
            border: "3px solid #000",
            transform: "rotate(-8deg)",
          }}
        />
      </div>
    ),
    {
      ...size,
    },
  );
}
