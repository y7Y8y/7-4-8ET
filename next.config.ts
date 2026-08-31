import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*"],
  async redirects() {
    return [
      { source: "/combine", destination: "/", permanent: false },
      { source: "/cotes", destination: "/", permanent: false },
      { source: "/live", destination: "/", permanent: false },
      { source: "/pronostics", destination: "/", permanent: false },
      { source: "/highlights", destination: "/", permanent: false },
      { source: "/championnats", destination: "/infos", permanent: false },
      { source: "/matchs", destination: "/", permanent: false },
      { source: "/matchs/:id", destination: "/", permanent: false },
    ];
  },
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
