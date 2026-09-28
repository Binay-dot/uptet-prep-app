import type { Config } from "drizzle-kit";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../.env") });

/**
 * Reads DATABASE_MIGRATION_URL (the elevated role) — same reasoning as
 * migrate.ts. `pnpm --filter @uptet/database generate` uses this to
 * introspect and diff against the live database when generating a new
 * migration file; it never runs against DATABASE_URL.
 */
export default {
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_MIGRATION_URL ?? "",
  },
} satisfies Config;
