import type { Metadata } from "next";
import { Manrope, Source_Serif_4 } from "next/font/google";
import type { ReactElement, ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "UPTET Prep",
  description: "UPTET exam prep with real score and readiness prediction.",
};

/**
 * Same two typefaces as the Claude Design canvas prototype (Manrope for
 * UI text, Source Serif 4 for headings/numbers) — see
 * tailwind.config.ts's file comment. next/font/google self-hosts these
 * at build time (no runtime request to Google Fonts, no layout-shift
 * flash), exposed as CSS custom properties so tailwind.config.ts's
 * fontFamily.sans/serif can reference them.
 */
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-manrope",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-source-serif",
  display: "swap",
});

// Explicit return type, not inferred: with two @types/react versions
// present in this monorepo's pnpm store (this app pins v19, apps/mobile
// pins v18 for React Native), TS can't always print a portable name for
// an *inferred* JSX return type (TS2742) even though this file's own
// "react" import is correctly resolved to v19. Naming the type directly
// sidesteps that entirely — do the same in any new page/layout file.
export default function RootLayout({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  return (
    <html lang="en" className={`${manrope.variable} ${sourceSerif.variable}`}>
      <body className="bg-bg font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
