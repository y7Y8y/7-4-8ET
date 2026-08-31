import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/syne/600.css";
import "@fontsource/syne/700.css";
import "@fontsource/syne/800.css";
import "@fontsource/bebas-neue/400.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "NINETY — Live, cotes, pronostics",
    template: "%s · NINETY",
  },
  description:
    "Cockpit football : scores en direct, comparateur de cotes, modèle de pronostics et highlights. API-Football, football-data.org, The Odds API, Highlightly.",
  openGraph: {
    title: "NINETY",
    description: "Le football, sans le bruit.",
    images: ["/og.jpg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="font-sans antialiased">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
