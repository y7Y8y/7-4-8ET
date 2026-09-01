import type { Metadata, Viewport } from "next";
import { PhoneShell } from "@/components/phone-shell";
import { ScanConfigProvider } from "@/components/scan-config";
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
    default: "NINETY — paniers 1,01",
    template: "%s · NINETY",
  },
  description: "Paniers 1xBet 1,01. 50 sélections, 5 par jour. Pré-match, à recopier à la main.",
  applicationName: "NINETY 1.01",
  appleWebApp: {
    capable: true,
    title: "NINETY 1.01",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#050507",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="font-sans antialiased">
        <ScanConfigProvider>
          <PhoneShell>{children}</PhoneShell>
        </ScanConfigProvider>
      </body>
    </html>
  );
}
