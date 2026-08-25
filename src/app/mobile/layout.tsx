import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Betrieb · Zelic Family Vir",
  description: "Mobile Betriebsübersicht für Zelic Family Vir",
  applicationName: "Zelic Family Vir",
  manifest: "/mobile/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Zelic Family Vir",
  },
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

export default function MobileLayout({ children }: { children: ReactNode }) {
  return children;
}
