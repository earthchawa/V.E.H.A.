// Empty every app table (keeping the migration history) and load the demo data with DEMO_PASSWORD.
import { execFileSync, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { ROOT, dbUrl, DEMO_PASSWORD } = require("./lib.js");
const psql = (q) => execFileSync("psql", [dbUrl(), "-t", "-A", "-q", "-c", q]).toString().trim();

const tables = psql(`select string_agg(format('%I', tablename), ',') from pg_tables where schemaname = 'public' and tablename <> '_prisma_migrations'`);
if (tables) psql(`truncate ${tables} cascade`);
// Uploaded files of the disk storage driver (only ever inside the project folder).
const uploads = path.resolve(ROOT, process.env.UPLOAD_DIR || "storage/uploads");
if (uploads.startsWith(ROOT + path.sep)) rmSync(uploads, { recursive: true, force: true });
const r = spawnSync("npx", ["tsx", "prisma/seed.ts", "--demo"], { cwd: ROOT, env: { ...process.env, DEMO_PASSWORD }, encoding: "utf8" });
if (r.status !== 0) {
  console.error(r.stdout, r.stderr);
  process.exit(1);
}
