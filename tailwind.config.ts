import type { Config } from "tailwindcss";

// Design tokens: "Editorial Voyage" — deep cobalt for structure and calls
// to action, sunset terracotta for warmth and live states, sage for
// verified/complete states, on a cool near-white canvas. Colors resolve
// from CSS variables in app/globals.css so runtime code (the map markers)
// reads the same values as the stylesheet.
const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "hsl(var(--ink))",
        paper: "hsl(var(--paper))",
        surface: "hsl(var(--surface))",
        border: "hsl(var(--line))",
        muted: "hsl(var(--muted))",
        accent: {
          DEFAULT: "hsl(var(--accent))",
          soft: "hsl(var(--accent-soft))",
        },
        warm: {
          DEFAULT: "hsl(var(--warm))",
          soft: "hsl(var(--warm-soft))",
        },
        sunset: "hsl(var(--sunset))",
        sage: "hsl(var(--sage))",
        deep: "hsl(var(--deep))",
      },
      borderRadius: {
        sm: "0.25rem",
        DEFAULT: "0.5rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.5rem",
      },
      boxShadow: {
        card: "0 2px 8px -2px rgba(20,40,80,0.05), 0 1px 4px -1px rgba(20,40,80,0.03)",
        lift: "0 12px 24px -6px rgba(20,40,80,0.08), 0 4px 10px -2px rgba(20,40,80,0.04)",
        float: "0 20px 40px -8px rgba(20,40,80,0.14)",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
