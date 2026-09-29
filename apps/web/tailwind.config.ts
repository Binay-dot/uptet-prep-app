import type { Config } from "tailwindcss";

/**
 * Design tokens ported from the Claude Design canvas prototype
 * (a separate, disconnected mock-data artboard — see
 * docs/work/current.md). Porting the same hex values here rather than
 * re-deriving a palette keeps the real, backend-wired pages visually
 * consistent with that prototype instead of introducing a second,
 * drifting design language.
 */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-manrope)", "system-ui", "sans-serif"],
        serif: ["var(--font-source-serif)", "Georgia", "serif"],
      },
      colors: {
        bg: "#F7F5F1",
        card: "#FFFFFF",
        border: "#E4E0D9",
        divider: "#EFEBE3",
        ink: {
          DEFAULT: "#1C1B1A",
          muted: "#6B6660",
          faint: "#8A8479",
        },
        accent: {
          DEFAULT: "#24406B",
          tint: "#E8EDF5",
        },
        status: {
          strong: "#3E8E6C",
          strongBg: "#DCEEE4",
          strongText: "#1E6B4F",
          developing: "#C98A2E",
          developingBg: "#FBEDD8",
          developingText: "#8A5A17",
          needsWork: "#B8524B",
          needsWorkBg: "#F8E2DF",
          needsWorkText: "#9B3A34",
        },
      },
      borderRadius: {
        card: "16px",
        row: "12px",
        pill: "9999px",
      },
    },
  },
  plugins: [],
} satisfies Config;
