import { redirect } from "next/navigation";
import type { ReactElement } from "react";
import { auth0 } from "@/server/auth/auth0Client";

/**
 * Landing page. Explicitly session-aware: a signed-in visitor is sent
 * straight to /dashboard rather than shown a "Sign in to start" button
 * that would just loop them back here after a successful login (the
 * Auth0 SDK's /auth/login route returns to "/" by default with no
 * returnTo). This was the source of a real reported issue: login
 * genuinely succeeded (real code exchange, real session cookies set)
 * but the user landed back on this same static page and had to
 * manually navigate to /dashboard themselves, both locally and once
 * deployed. The `returnTo` param on the sign-in link fixes the
 * fresh-login case; the session check here fixes the
 * already-signed-in-visits-"/" case (bookmarked root URL, browser
 * back button, etc.) that `returnTo` alone wouldn't cover.
 *
 * Still visually a placeholder otherwise — real design is a separate
 * pass (see docs/work/current.md).
 *
 * Explicit return type — see the comment in src/app/layout.tsx (TS2742,
 * caused by apps/mobile's separate @types/react version).
 */
export default async function LandingPage(): Promise<ReactElement> {
  const session = await auth0.getSession();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">UPTET Prep</h1>
      <p className="text-sm text-gray-600">
        Real UPTET practice questions with an honest, statistically-grounded
        prediction of your readiness — not just a raw score.
      </p>
      <a
        href="/auth/login?returnTo=/dashboard"
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
      >
        Sign in to start
      </a>
    </main>
  );
}
