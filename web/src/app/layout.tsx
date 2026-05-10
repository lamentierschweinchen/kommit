import type { Metadata, Viewport } from "next";
import { bricolage, publicSans, jetbrainsMono } from "@/lib/fonts";
import { ProvidersMount } from "@/components/providers-mount";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ToastProvider } from "@/components/common/ToastProvider";
import { DemoControls } from "@/components/layout/DemoControls";
import "@/styles/globals.css";

/**
 * Resolve the public site URL for metadata. Vercel injects VERCEL_URL on the
 * deployment side, so this stays accurate per-environment. Falls back to the
 * canonical alias for local builds and prod overrides.
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://kommit.now");

export const metadata: Metadata = {
  title: "Kommit — Turn conviction into currency",
  description:
    "Back early-stage projects without locking your money. Earn kommits the longer you stay.",
  metadataBase: new URL(SITE_URL),
  // OG / Twitter image is generated dynamically via app/opengraph-image.tsx;
  // Next emits the right meta tags automatically. Listing them here is no
  // longer required — keeping the title/description overrides for clarity.
  openGraph: {
    type: "website",
    siteName: "Kommit",
    title: "Kommit — Turn conviction into currency.",
    description:
      "Back early-stage projects without locking your money. Earn kommits the longer you stay.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kommit — Turn conviction into currency.",
    description:
      "Back early-stage projects without locking your money. Earn kommits the longer you stay.",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${publicSans.variable} ${jetbrainsMono.variable} light`}
    >
      <body className="min-h-screen flex flex-col bg-white text-dark antialiased selection:bg-primary selection:text-white">
        <ProvidersMount>
          <AuthProvider>
            <ToastProvider>
              {children}
              {/* Self-gates via useDemoMode — renders only when the demo
                  env flag or the localStorage flag set by /demo is on. */}
              <DemoControls />
            </ToastProvider>
          </AuthProvider>
        </ProvidersMount>
      </body>
    </html>
  );
}
