import type { ReactElement } from "react";

/**
 * Placeholder landing page. Intentionally minimal — real visual design
 * for this is planned as a separate pass (see chat history: UI/UX via
 * the Design artifact type), this just proves the route + auth wiring.
 *
 * Explicit return type — see the comment in src/app/layout.tsx (TS2742,
 * caused by apps/mobile's separate @types/react version).
 */
export default function LandingPage(): ReactElement {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">UPTET Prep</h1>
      <p className="text-sm text-gray-600">
        Real UPTET practice questions with an honest, statistically-grounded
        prediction of your readiness — not just a raw score.
      </p>
      <a
        href="/auth/login"
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
      >
        Sign in to start
      </a>
    </main>
  );
}
