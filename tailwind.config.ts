import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#050507",
          900: "#0a0a0f",
          800: "#12131a",
          700: "#1b1c26",
          600: "#2a2c38",
        },
        lime: {
          DEFAULT: "#d8ff3c",
          dim: "#b6d94a",
        },
        live: "#ff3d6e",
        paper: "#ece8df",
        mist: "#9aa0b4",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        sans: ["var(--font-sans)", "sans-serif"],
        score: ["var(--font-score)", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px rgba(216, 255, 60, 0.18)",
      },
      backgroundImage: {
        grain:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .18 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
      },
    },
  },
  plugins: [],
};

export default config;
