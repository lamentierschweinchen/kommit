import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ProvidersMount } from "@/components/providers-mount";
import { SiteHeader } from "@/components/kommit/site-header";
import { SiteFooter } from "@/components/kommit/site-footer";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Kommit — back the next big idea",
  description:
    "Park USDC. Yield streams to the team building it. Withdraw your principal anytime. Earn on-chain reputation.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <ProvidersMount>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
          <Toaster />
        </ProvidersMount>
      </body>
    </html>
  );
}
