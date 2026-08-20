import type { Config } from "tailwindcss";

// GSI Analytics Portal — token system
// Colors map 1:1 to the Microsoft Fluent-inspired palette specified for this build.
// Keep this file the single source of truth for color/spacing tokens; components
// should reference these names, not raw hex values.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Synergetics brand palette (synergetics-india.com): raspberry + maroon
        // primary, orange accent. Microsoft GSI remains a partner mark only.
        primary: {
          DEFAULT: "#A52759",
          dark: "#641B38",
          light: "#D87E9F",
          tint: "#FBF0F4",
        },
        accent: {
          DEFAULT: "#FB6B0C",
          light: "#F9A974",
        },
        surface: {
          bg: "#F3F2F1",
          card: "#FFFFFF",
          border: "#E1DFDD",
          hover: "#F5F5F5",
        },
        ink: {
          DEFAULT: "#323130",
          subtle: "#605E5C",
          disabled: "#A19F9D",
        },
        status: {
          success: "#107C10",
          successBg: "#DFF6DD",
          warning: "#FFB900",
          warningBg: "#FFF4CE",
          danger: "#D13438",
          dangerBg: "#FDE7E9",
        },
      },
      fontFamily: {
        sans: [
          "PT Sans",
          "Segoe UI Variable",
          "Segoe UI",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
        display: ["Oswald", "PT Sans", "sans-serif"],
        mono: ["Cascadia Code", "Consolas", "monospace"],
      },
      borderRadius: {
        card: "8px",
        pill: "999px",
      },
      boxShadow: {
        card: "0 1.6px 3.6px rgba(0,0,0,0.10), 0 0.3px 0.9px rgba(0,0,0,0.08)",
        elevated: "0 6.4px 14.4px rgba(0,0,0,0.13), 0 1.2px 3.6px rgba(0,0,0,0.10)",
        flyout: "0 25.6px 57.6px rgba(0,0,0,0.22), 0 4.8px 14.4px rgba(0,0,0,0.18)",
      },
      backdropBlur: {
        glass: "20px",
      },
    },
  },
  plugins: [],
};

export default config;
