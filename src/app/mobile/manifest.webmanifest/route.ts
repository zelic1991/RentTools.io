import { NextResponse } from "next/server";

export function GET() {
  return new NextResponse(JSON.stringify({
    name: "Zelic Family Vir Betrieb",
    short_name: "Zelic Vir",
    description: "Mobile Betriebsübersicht auf Basis des RentTools-Masters.",
    id: "/mobile",
    start_url: "/mobile",
    scope: "/mobile",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#F6F1E6",
    theme_color: "#F6F1E6",
    lang: "de",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  }), {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "application/manifest+json; charset=utf-8",
    },
  });
}
