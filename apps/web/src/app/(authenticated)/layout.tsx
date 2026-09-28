import { redirect } from "next/navigation";
import type { ReactElement, ReactNode } from "react";
import { auth0 } from "@/server/auth/auth0Client";

/**
 * Page-level gate: redirects to sign-in if there's no session at all.
 * This is a UX convenience, NOT the authorization boundary — that's
 * resolveActor() (server/auth/actor.ts), used by every API route. A page
 * under this layout can still render for a user whose account row is
 * `pending_deletion`; only the API calls it makes will be rejected. Don't
 * add data-fetching logic here that assumes otherwise.
 *
 * Explicit return type — see the comment in src/app/layout.tsx (TS2742,
 * caused by apps/mobile's separate @types/react version).
 */
export default async function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}): Promise<ReactElement> {
  const session = await auth0.getSession();
  if (!session) {
    redirect("/auth/login");
  }
  return <>{children}</>;
}
