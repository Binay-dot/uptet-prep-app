import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Ordinary application requests use DATABASE_URL, which MUST point at a
 * restricted Postgres role that cannot ALTER/CREATE/DROP and cannot touch
 * tables outside this app's schema. Never widen this role's grants to
 * make a one-off query convenient — see docs/security.md ("a separate,
 * more restricted database role for ordinary requests than for
 * migrations"). The more privileged role used by `pnpm db:migrate` lives
 * behind DATABASE_MIGRATION_URL instead (see migrate.ts) and is never
 * imported by application request-handling code.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env and fill it in — see docs/runbooks/local-setup.md.`,
    );
  }
  return value;
}

/**
 * IMPORTANT: this must be typed explicitly as `PostgresJsDatabase<typeof
 * schema>`, not inferred via `ReturnType<typeof drizzle>`. `drizzle` is a
 * generic function; `typeof drizzle` captures its *unapplied* generic
 * signature, so `ReturnType<typeof drizzle>` silently collapses back to
 * drizzle's default type parameter (`Record<string, never>`) instead of
 * our actual schema — which makes `db.query.<table>` disappear entirely
 * (it type-checks as `{}`), with no error at the call site to point at
 * why. Ask me how long this one took to track down.
 */
let cachedClient: PostgresJsDatabase<typeof schema> | undefined;

/**
 * Lazily creates (and caches) the app-role Drizzle client. Lazy so that
 * importing this module doesn't blow up at build/lint time before env
 * vars are configured; the error only surfaces when a request actually
 * needs the database.
 */
export function getDb(): PostgresJsDatabase<typeof schema> {
  if (!cachedClient) {
    const connectionString = requireEnv("DATABASE_URL");
    const queryClient = postgres(connectionString, { max: 10 });
    cachedClient = drizzle(queryClient, { schema });
  }
  return cachedClient;
}

export { schema };
export type Database = PostgresJsDatabase<typeof schema>;
