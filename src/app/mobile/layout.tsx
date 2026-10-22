import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { getLocale } from "@/lib/i18n/server";
import { resolveCopy, type CopyMap } from "@/lib/i18n/translations";

const COPY: CopyMap<{ title: string; description: string }> = {
  en: { title: "Operations · Zelic Family Vir", description: "Mobile operations overview for Zelic Family Vir" },
  ru: { title: "Работа · Zelic Family Vir", description: "Мобильный обзор работы для Zelic Family Vir" },
  de: { title: "Betrieb · Zelic Family Vir", description: "Mobile Betriebsübersicht für Zelic Family Vir" },
  fr: { title: "Exploitation · Zelic Family Vir", description: "Vue d’ensemble mobile de l’exploitation pour Zelic Family Vir" },
  es: { title: "Operaciones · Zelic Family Vir", description: "Resumen móvil de operaciones para Zelic Family Vir" },
  hr: { title: "Poslovanje · Zelic Family Vir", description: "Mobilni pregled poslovanja za Zelic Family Vir" },
};

export async function generateMetadata(): Promise<Metadata> {
  const copy = resolveCopy(COPY, await getLocale());
  return {
    ...BASE_METADATA,
    title: copy.title,
    description: copy.description,
  };
}

const BASE_METADATA: Metadata = {
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
    { media: "(prefers-color-scheme: light)", color: "#F6F1E6" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

export default function MobileLayout({ children }: { children: ReactNode }) {
  return children;
}
