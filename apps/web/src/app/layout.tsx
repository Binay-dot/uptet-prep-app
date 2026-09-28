import type { Metadata } from "next";
import type { ReactElement, ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "UPTET Prep",
  description: "UPTET exam prep with real score and readiness prediction.",
};

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
