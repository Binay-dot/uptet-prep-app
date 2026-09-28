#!/usr/bin/env tsx
/**
 * `pnpm doctor` — checks the local setup for the exact class of problems
 * that came up while first setting this factory up (see
 * docs/runbooks/local-setup.md): a .env file secretly saved as .env.txt,
 * a missing required var, node_modules not installed, the wrong Node
 * version. Run this before asking "why doesn't it work" — it's meant to
 * answer that in one pass instead of one Google search at a time.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

let hasError = false;
let hasWarning = false;

function ok(message: string) {
  console.log(`  \x1b[32m✓\x1b[0m ${message}`);
}
function warn(message: string) {
  hasWarning = true;
  console.log(`  \x1b[33m!\x1b[0m ${message}`);
}
function fail(message: string) {
  hasError = true;
  console.log(`  \x1b[31m✗\x1b[0m ${message}`);
}

function checkNodeVersion() {
  console.log("Node version");
  const major = Number(process.versions.node.split(".")[0]);
  if (major >= 20) {
    ok(`Node ${process.versions.node} (>= 20 required)`);
  } else {
    fail(`Node ${process.versions.node} — this project requires Node 20+.`);
  }
}

function checkForDotEnvTxtTrap() {
  console.log("\n.env file");
  const envPath = join(ROOT, ".env");
  const envTxtPath = join(ROOT, ".env.txt");

  if (existsSync(envTxtPath) && !existsSync(envPath)) {
    fail(
      ".env.txt exists but .env does not — this usually means a text editor " +
        "silently added a .txt extension when the file was saved. Rename " +
        ".env.txt to .env (make sure 'show file extensions' is on so you can " +
        "verify the rename actually worked).",
    );
    return;
  }

  if (!existsSync(envPath)) {
    fail(".env is missing. Copy .env.example to .env and fill it in.");
    return;
  }
  ok(".env exists.");
}

const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "DATABASE_MIGRATION_URL",
  "AUTH0_SECRET",
  "AUTH0_DOMAIN",
  "AUTH0_CLIENT_ID",
  "AUTH0_CLIENT_SECRET",
  "APP_BASE_URL",
  "AUTH0_AUDIENCE",
];

function checkRequiredEnvVars() {
  console.log("\nRequired environment variables");
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) {
    warn("Skipped — .env doesn't exist yet (see above).");
    return;
  }

  const envContents = readFileSync(envPath, "utf-8");
  const definedKeys = new Set(
    envContents
      .split("\n")
      .map((line) => line.match(/^([A-Za-z0-9_]+)=/)?.[1])
      .filter((key): key is string => Boolean(key)),
  );

  for (const key of REQUIRED_ENV_VARS) {
    if (definedKeys.has(key)) {
      const value = envContents.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1] ?? "";
      if (value.trim().length === 0) {
        warn(`${key} is present but empty.`);
      } else {
        ok(key);
      }
    } else {
      fail(`${key} is missing from .env.`);
    }
  }
}

function checkNodeModulesInstalled() {
  console.log("\nDependencies");
  const workspacePackages = [
    "apps/web",
    "apps/mobile",
    "packages/contracts",
    "packages/domain",
    "packages/database",
  ];
  for (const pkg of workspacePackages) {
    const nodeModulesPath = join(ROOT, pkg, "node_modules");
    if (existsSync(nodeModulesPath)) {
      ok(`${pkg}/node_modules exists`);
    } else {
      fail(`${pkg}/node_modules is missing — run 'pnpm install' from the repo root.`);
    }
  }
}

function checkMigrationsExist() {
  console.log("\nDatabase migrations");
  const migrationsDir = join(ROOT, "packages/database/migrations");
  if (!existsSync(migrationsDir)) {
    warn(
      "No migrations folder yet — run 'pnpm --filter @uptet/database generate' " +
        "after your first schema change.",
    );
    return;
  }
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
  if (files.length === 0) {
    warn("Migrations folder exists but has no .sql files yet.");
  } else {
    ok(`${files.length} migration file(s) found.`);
  }
}

console.log("Running factory doctor checks...\n");
checkNodeVersion();
checkForDotEnvTxtTrap();
checkRequiredEnvVars();
checkNodeModulesInstalled();
checkMigrationsExist();

console.log();
if (hasError) {
  console.log("\x1b[31mSome checks failed — fix the ✗ items above.\x1b[0m");
  process.exit(1);
} else if (hasWarning) {
  console.log("\x1b[33mAll critical checks passed, but see the ! items above.\x1b[0m");
} else {
  console.log("\x1b[32mAll checks passed.\x1b[0m");
}
