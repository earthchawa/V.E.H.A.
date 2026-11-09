#!/usr/bin/env node
// End-to-end runner: starts `next start` (unless E2E_BASE_URL points at a running server), reseeds the
// database before every suite, runs the Playwright suites in e2e/suites and prints a summary.
//
//   npm run build && npm run test:e2e                 # all suites
//   npm run test:e2e -- 05-quiz 10-code-questions     # only these
//
// Needs: a built app, DATABASE_URL (from .env) pointing at a disposable database, psql, Playwright + Chromium.
// WARNING: every suite empties the database. Never point it at real data.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { ROOT, BASE, DEMO_PASSWORD, dbUrl } = require("./lib.js");
const env = { ...process.env, DEMO_PASSWORD, COOKIE_SECURE: "false", SMTP_HOST: "" };

if (!dbUrl()) throw new Error("DATABASE_URL is not set (copy .env.example to .env).");
if (/neon\.tech|vercel|amazonaws|supabase/.test(dbUrl()) && !process.env.E2E_ALLOW_REMOTE_DB) {
  throw new Error("DATABASE_URL looks like a hosted database. The suites wipe it — use a local one (or set E2E_ALLOW_REMOTE_DB=1).");
}

const all = readdirSync(path.join(ROOT, "e2e/suites")).filter((f) => f.endsWith(".js")).sort();
const wanted = process.argv.slice(2);
const suites = wanted.length ? all.filter((f) => wanted.some((w) => f.startsWith(w) || f === `${w}.js`)) : all;

const up = async () => fetch(`${BASE}/login`).then((r) => r.ok, () => false);
let server = null;
if (!(await up())) {
  if (!existsSync(path.join(ROOT, ".next"))) throw new Error("No build found — run `npm run build` first.");
  const port = new URL(BASE).port || "3000";
  server = spawn("npx", ["next", "start", "-p", port], { cwd: ROOT, env, stdio: "ignore", detached: true });
  for (let i = 0; i < 60 && !(await up()); i++) await new Promise((r) => setTimeout(r, 1000));
  if (!(await up())) throw new Error(`Server did not start on ${BASE}`);
}

const reseed = () => {
  const r = spawnSync("node", [path.join(ROOT, "e2e/reseed.mjs")], { cwd: ROOT, env, encoding: "utf8" });
  if (r.status !== 0) throw new Error("Reseed failed:\n" + r.stderr + r.stdout);
};

const results = [];
for (const s of suites) {
  // The phone-layout check runs at a few widths.
  const runs = s.includes("mobile-overflow") ? ["360", "390", "1024"].map((w) => ({ W: w })) : [{}];
  for (const extra of runs) {
    reseed();
    const t0 = Date.now();
    const r = spawnSync("node", [path.join(ROOT, "e2e/suites", s)], { cwd: ROOT, env: { ...env, ...extra }, encoding: "utf8", timeout: 600_000 });
    const out = (r.stdout || "") + (r.stderr || "");
    const passed = (out.match(/^PASS /gm) || []).length;
    const ok = r.status === 0 && /ALL OK\s*$/.test(out.trim());
    const name = s.replace(/\.js$/, "") + (extra.W ? ` @${extra.W}px` : "");
    results.push({ name, ok, passed, secs: Math.round((Date.now() - t0) / 1000) });
    console.log(`${ok ? "✓" : "✗"} ${name}  ${passed} checks  ${Math.round((Date.now() - t0) / 1000)}s`);
    if (!ok) console.log(out.split("\n").filter((l) => /FAIL|Error|waiting for|XX /.test(l)).slice(0, 8).map((l) => "    " + l).join("\n"));
  }
}
if (server) process.kill(-server.pid);
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} suites passed, ${results.reduce((n, r) => n + r.passed, 0)} checks.`);
process.exit(failed.length ? 1 : 0);
