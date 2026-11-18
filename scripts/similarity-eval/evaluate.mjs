#!/usr/bin/env node
// Precision / recall / F1 from scores.csv (written by run-web.cjs) — the numbers for the article's tables.
//
//   node scripts/similarity-eval/evaluate.mjs <dataset-dir>/web-run/scores.csv [--thresholds 0.15,0.40]
//
// A pair's score is the larger of its two shares (as in the instructor's "top pairs" list). A pair counts as
// "flagged" when that score is at or above the threshold. L0 (exact copies) is a sanity check and is left out.
// Groups: tasks starting with T = Thai prose, P = Python code. Both settings of "ignore common passages" are reported.
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
if (!file) throw new Error("usage: evaluate.mjs <scores.csv> [--thresholds 0.15,0.40]");
const ti = args.indexOf("--thresholds");
const THRESHOLDS = (ti >= 0 ? args[ti + 1] : "0.15,0.40").split(",").map(Number);

const [head, ...lines] = fs.readFileSync(file, "utf8").trim().split("\n");
const cols = head.split(",");
const rows = lines.map((l) => Object.fromEntries(l.split(",").map((v, i) => [cols[i], v])));
const score = (r, s) => Math.max(Number(r[`${s}_a`]), Number(r[`${s}_b`]));
const group = (r) => (r.task.startsWith("P") ? "code" : "text");
const LEVELS = [...new Set(rows.filter((r) => r.label === "1" && r.level !== "L0").map((r) => r.level))].sort();
const f2 = (x) => (Number.isNaN(x) ? "–" : x.toFixed(2));

const out = [];
const sanity = rows.filter((r) => r.level === "L0");
out.push(`# Similarity check evaluation`, ``, `Source: ${path.resolve(file)}`, `Generated: ${new Date().toISOString()}`, ``);
out.push(`Sanity check (L0, exact copies): lowest score ${f2(Math.min(...sanity.map((r) => score(r, "off"))))} with ignoreCommon off (should be 1.00).`, ``);

for (const setting of ["on", "off"]) {
  out.push(`## ignoreCommon ${setting}`, ``);
  for (const t of THRESHOLDS) {
    out.push(`### Threshold ${Math.round(t * 100)}%`, ``, `| Group | Precision | Recall | F1 | TP | FP | FN | TN | Pairs |`, `|---|---|---|---|---|---|---|---|---|`);
    for (const g of ["text", "code", "all"]) {
      const rs = rows.filter((r) => r.level !== "L0" && (g === "all" || group(r) === g));
      const c = { tp: 0, fp: 0, fn: 0, tn: 0 };
      for (const r of rs) {
        const flagged = score(r, setting) >= t;
        const copied = r.label === "1";
        c[copied ? (flagged ? "tp" : "fn") : flagged ? "fp" : "tn"]++;
      }
      const p = c.tp / (c.tp + c.fp);
      const rc = c.tp / (c.tp + c.fn);
      const f1 = (2 * p * rc) / (p + rc);
      out.push(`| ${g} | ${f2(p)} | ${f2(rc)} | ${f2(f1)} | ${c.tp} | ${c.fp} | ${c.fn} | ${c.tn} | ${rs.length} |`);
    }
    out.push(``, `Recall by level:`, ``, `| Group | ${LEVELS.join(" | ")} |`, `|---|${LEVELS.map(() => "---").join("|")}|`);
    for (const g of ["text", "code"]) {
      const cells = LEVELS.map((lv) => {
        const rs = rows.filter((r) => r.label === "1" && r.level === lv && group(r) === g);
        return rs.length ? `${f2(rs.filter((r) => score(r, setting) >= t).length / rs.length)} (n=${rs.length})` : "–";
      });
      out.push(`| ${g} | ${cells.join(" | ")} |`);
    }
    out.push(``);
  }
  out.push(`Mean score by level (${setting}):`, ``, `| Group | independent | ${LEVELS.join(" | ")} |`, `|---|---|${LEVELS.map(() => "---").join("|")}|`);
  for (const g of ["text", "code"]) {
    const mean = (lv) => {
      const rs = rows.filter((r) => r.level === lv && group(r) === g);
      return rs.length ? f2(rs.reduce((n, r) => n + score(r, setting), 0) / rs.length) : "–";
    };
    out.push(`| ${g} | ${mean("independent")} | ${LEVELS.map(mean).join(" | ")} |`);
  }
  out.push(``);
}
const report = out.join("\n");
fs.writeFileSync(path.join(path.dirname(file), "results.md"), report + "\n");
console.log(report);
