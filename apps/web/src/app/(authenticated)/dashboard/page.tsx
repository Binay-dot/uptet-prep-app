"use client";

import { useEffect, useState, type ReactElement } from "react";
import type { UserDto, ApiErrorResponse } from "@uptet/contracts";

const PAPER_LABELS: Record<string, string> = {
  paper_1: "Paper 1 (Primary)",
  paper_2: "Paper 2 (Upper Primary)",
};

/**
 * Real design pass over the previously-placeholder dashboard (see
 * docs/work/current.md's "Next" list — this was the outstanding item).
 * Colors/type/spacing ported from the Claude Design canvas prototype
 * (tailwind.config.ts's file comment has the full story); the data
 * fetching logic itself is unchanged from the placeholder version —
 * this is a styling pass, not a behavior change.
 */
export default function DashboardPage(): ReactElement {
  const [user, setUser] = useState<UserDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/v1/me", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preparingFor: ["paper_1"] }),
        });
        const json = await response.json();
        if (!response.ok) {
          const errorBody = json as ApiErrorResponse;
          throw new Error(errorBody.error?.message ?? `Request failed (${response.status})`);
        }
        setUser(json as UserDto);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-8 px-7 py-9">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint">
          UPTET Prep
        </div>
        <h1 className="mt-3 font-serif text-[32px] font-semibold leading-tight tracking-tight">
          Welcome back
        </h1>
      </div>

      {isLoading ? (
        <div className="rounded-card border border-border bg-card p-5 text-sm text-ink-muted shadow-sm">
          Loading your profile…
        </div>
      ) : null}

      {error ? (
        <div className="rounded-card border border-status-needsWork/40 bg-status-needsWorkBg p-4 text-sm text-status-needsWorkText">
          Couldn&apos;t load your profile: {error}
        </div>
      ) : null}

      {user ? (
        <div className="flex flex-col gap-4 rounded-card border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] text-ink-faint">Preparing for</span>
            <span className="text-sm font-semibold">
              {user.preparingFor.map((p) => PAPER_LABELS[p] ?? p).join(", ")}
            </span>
          </div>
          <div className="h-px bg-divider" />
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] text-ink-faint">Member since</span>
            <span className="text-sm font-semibold">
              {new Date(user.createdAt).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
      ) : null}

      <a
        href="/quiz"
        className="block w-full rounded-row bg-accent px-4 py-4 text-center text-[15px] font-semibold tracking-wide text-white shadow-sm transition-opacity hover:opacity-90"
      >
        Start a practice quiz
      </a>
    </main>
  );
}
