import type { Metadata } from "next";
import { bricolage, publicSans, jetbrainsMono } from "@/lib/fonts";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ToastProvider } from "@/components/common/ToastProvider";
import { DemoControls } from "@/components/layout/DemoControls";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Kommit — Turn conviction into currency",
  description:
    "Back early-stage projects without locking your money. Earn kommits the longer you stay.",
  metadataBase: new URL("https://kommit.vercel.app"),
  openGraph: {
    type: "website",
    siteName: "Kommit",
    title: "Kommit — Turn conviction into currency.",
    description:
      "Back early-stage projects without locking your money. Earn kommits the longer you stay.",
    images: ["/assets/og-default.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kommit — Turn conviction into currency.",
    description:
      "Back early-stage projects without locking your money. Earn kommits the longer you stay.",
    images: ["/assets/og-default.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${publicSans.variable} ${jetbrainsMono.variable} light`}
    >
      <body className="min-h-screen flex flex-col bg-white text-dark antialiased selection:bg-primary selection:text-white">
        <AuthProvider>
          <ToastProvider>
            {children}
            <DemoControls />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
