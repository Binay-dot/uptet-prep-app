"use client";

import { useEffect, useState, type ReactElement } from "react";
import type { UserDto, ApiErrorResponse } from "@uptet/contracts";

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
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      {isLoading ? <p className="mt-2 text-sm text-gray-600">Loading your profile...</p> : null}

      {error ? (
        <p className="mt-2 text-sm text-red-600">
          Couldn&apos;t load your profile: {error}
        </p>
      ) : null}

      {user ? (
        <div className="mt-2 text-sm text-gray-800">
          <p>Signed in as user ID: {user.id}</p>
          <p>Preparing for: {user.preparingFor.join(", ")}</p>
          <p>Account created: {new Date(user.createdAt).toLocaleString()}</p>
        </div>
      ) : null}

      <a
        href="/quiz"
        className="mt-4 inline-block rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
      >
        Start a practice quiz
      </a>
    </main>
  );
}