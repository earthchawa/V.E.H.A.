/**
 * Build command on Vercel (npm runs "vercel-build" instead of "build" when present):
 * 1. find the database URL (whatever name the integration used) and log which one is used,
 * 2. apply migrations over a direct (unpooled) connection — Neon's pooler can't run them,
 * 3. with DEMO_SEED=true, create/refresh the demo accounts and sample data (idempotent),
 * 4. build Next.js.
 */
import { execSync } from "node:child_process";
import { resolveDatabaseEnv } from "../src/lib/db-url";

const db = resolveDatabaseEnv(process.env);
console.log(`[vercel-build] VERCEL_ENV=${process.env.VERCEL_ENV ?? "-"}`);
console.log(`[vercel-build] database-related variables present: ${db.candidates.join(", ") || "(none)"}`);

if (!db.url) {
  console.error(
    [
      "",
      "ERROR: no Postgres connection string found for this deployment.",
      `This build runs in the "${process.env.VERCEL_ENV ?? "?"}" environment. In Vercel:`,
      "  • Storage → your database → Connect Project: tick this environment (Production and Preview),",
      "  • or Settings → Environment Variables: add DATABASE_URL for this environment,",
      "then deploy the latest commit again.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}
console.log(`[vercel-build] app uses ${db.urlFrom}; migrations use ${db.directFrom ?? db.urlFrom}`);

const run = (cmd: string, databaseUrl = db.url!) =>
  execSync(cmd, { stdio: "inherit", env: { ...process.env, DATABASE_URL: databaseUrl } });

run("npx prisma migrate deploy", db.directUrl ?? db.url);
if (process.env.DEMO_SEED === "true") run("npx tsx prisma/seed.ts --demo");
run("npx next build");
