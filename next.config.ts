import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "media.api-sports.io" },
      { protocol: "https", hostname: "crests.football-data.org" },
      { protocol: "https", hostname: "media.highlightly.net" },
      { protocol: "https", hostname: "*.highlightly.net" },
    ],
  },
};

export default nextConfig;
