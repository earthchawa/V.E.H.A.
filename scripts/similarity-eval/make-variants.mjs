#!/usr/bin/env node
// Builds the copied variants (levels L0–L3) of the chosen originals and writes pairs.csv.
//
//   node scripts/similarity-eval/make-variants.mjs <dataset-dir> [--seed 2569] [--sources H1,A1]
//
// <dataset-dir>/originals/<TASK>_<WRITER>.(txt|py)   e.g. T1_H1.txt, P2_A2.py   (input)
// <dataset-dir>/l4/<TASK>_<WRITER>_L4.(txt|py)        optional, paraphrased by a person / a fresh AI chat (input)
// <dataset-dir>/submissions/<TASK>/<file>             everything that will be submitted (output)
// <dataset-dir>/pairs.csv                              task,a,b,label,level (output)
//
// Levels are cumulative (as in Faidhi & Robinson): L1 = layout only; L2 = L1 + word/identifier changes;
// L3 = L2 + reordering. L0 is an exact copy (a sanity check, not counted in the results).
// Every random choice comes from a seeded generator, so the same seed gives byte-identical files.
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--"));
if (!dir) throw new Error("usage: make-variants.mjs <dataset-dir> [--seed N] [--sources H1,A1]");
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const SEED = Number(opt("seed", "2569"));
const SOURCES = opt("sources", "H1,A1").split(",");

// ---------- seeded random (mulberry32) ----------
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, SEED);
const shuffle = (arr, r) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ---------- Thai prose ----------
// Fixed list of interchangeable words/phrases (both directions). Applied to about half of the occurrences.
const SYNONYMS = [
  ["ข้อดี", "จุดเด่น"], ["ข้อเสีย", "จุดด้อย"], ["ผู้ใช้", "ผู้ใช้งาน"], ["โครงการ", "โปรเจกต์"],
  ["ความต้องการ", "ข้อกำหนด"], ["เนื่องจาก", "เพราะว่า"], ["เหมาะกับ", "เหมาะสมกับ"], ["ดังนั้น", "เพราะฉะนั้น"],
  ["สามารถ", "สามารถที่จะ"], ["อย่างไรก็ตาม", "อย่างไรก็ดี"], ["ตัวอย่างเช่น", "เช่น"],
  ["ลูกค้า", "ผู้ว่าจ้าง"], ["การเปลี่ยนแปลง", "การปรับเปลี่ยน"], ["รวดเร็ว", "ฉับไว"], ["ชัดเจน", "แน่ชัด"],
  ["ปัญหา", "อุปสรรค"], ["วิธีการ", "แนวทาง"], ["ระยะเวลา", "เวลา"], ["ทีมพัฒนา", "ทีมงาน"],
  ["ข้อมูล", "สารสนเทศ"], ["สัมภาษณ์", "พูดคุยสอบถาม"], ["แบบสอบถาม", "แบบสำรวจ"], ["หน่วยงาน", "องค์กร"],
  ["ประชุม", "หารือ"], ["ตรวจสอบ", "ตรวจทาน"], ["เพิ่มเติม", "เพิ่ม"], ["สำคัญ", "จำเป็น"],
];
const textL1 = (s, r) =>
  s
    .replace(/[ \t]+/g, () => (r() < 0.3 ? "  " : " "))
    .replace(/([,;:])/g, () => (r() < 0.5 ? " " : ","))
    .replace(/\n{2,}/g, () => (r() < 0.5 ? "\n" : "\n\n"));
// Whole words only: the text is cut into words with Intl.Segmenter (as the checker does), and a phrase is
// replaced only when it lines up with word boundaries (so "แต่" never matches inside "แต่ละ").
const SEG = new Intl.Segmenter("th", { granularity: "word" });
const SWAP = new Map(SYNONYMS.flatMap(([a, b]) => [[a, b], [b, a]]));
const textL2 = (s, r) => {
  const segs = [...SEG.segment(s)].map((x) => x.segment);
  const out = [];
  for (let i = 0; i < segs.length; ) {
    let hit = 0;
    for (let n = Math.min(4, segs.length - i); n >= 1 && !hit; n--) if (SWAP.has(segs.slice(i, i + n).join(""))) hit = n;
    if (hit) {
      const w = segs.slice(i, i + hit).join("");
      out.push(r() < 0.5 ? SWAP.get(w) : w);
      i += hit;
    } else out.push(segs[i++]);
  }
  return out.join("");
};
// Clauses are the space-separated runs inside a paragraph; shuffle paragraphs and the clauses of each.
const textL3 = (s, r) =>
  shuffle(s.split(/\n+/).filter((p) => p.trim()), r)
    .map((p) => shuffle(p.trim().split(/\s+/), r).join(" "))
    .join("\n\n");

// ---------- Python ----------
const PY_KEEP = new Set(
  ("False None True and as assert async await break class continue def del elif else except finally for from global if " +
    "import in is lambda nonlocal not or pass raise return try while with yield self print input int float str list dict set " +
    "tuple len range sorted sum min max abs round enumerate zip map filter open split strip lower upper join append items " +
    "keys values get sort reverse replace isalpha isdigit format count index pop update insert extend main __name__ __main__ " +
    "Counter collections defaultdict most_common key lambda reverse sys stdin readline end sep").split(" "),
);
// Split into code / string / comment pieces so renaming never touches strings or comments.
const pyPieces = (src) =>
  src.split(/((?:\b[rRbBfFuU]{1,2})?(?:"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|#[^\n]*)/);
const isLiteral = (p) => /^([rRbBfFuU]{0,2}["']|#)/.test(p);
const isFString = (p) => /^[rRbBuU]?[fF][rR]?["']/.test(p);
// Comments dropped or replaced, blank lines and spacing around "=" and "," changed (strings untouched).
const codeL1 = (s, r) =>
  pyPieces(s)
    .map((p) => {
      if (p.startsWith("#")) return r() < 0.5 ? "" : "# หมายเหตุ";
      if (isLiteral(p)) return p;
      return p
        .replace(/,[ \t]*/g, () => (r() < 0.5 ? "," : ", "))
        .replace(/(?<![=!<>+\-*/%])[ \t]*=[ \t]*(?!=)/g, () => (r() < 0.5 ? "=" : " = "))
        .replace(/\n{2,}/g, () => "\n".repeat(r() < 0.5 ? 1 : 3));
    })
    .join("")
    .replace(/[ \t]+$/gm, "");
// Rename only names the program itself defines (functions, parameters, assigned variables, loop variables),
// never attributes after "." or imported modules; names inside f-string braces are renamed too.
const ID = /(?<![.\w])[A-Za-z_]\w*\b/g;
const codeL2 = (s, r) => {
  const code = pyPieces(s).filter((p) => !isLiteral(p)).join(" ");
  const defined = new Set();
  const add = (list) => list.split(/[\s,()*=]+/).filter((n) => /^[A-Za-z_]\w*$/.test(n) && !PY_KEEP.has(n)).forEach((n) => defined.add(n));
  for (const m of code.matchAll(/\bdef\s+(\w+)\s*\(([^)]*)\)/g)) add(m[1] + "," + m[2].replace(/=[^,]*/g, "").replace(/:[^,]*/g, ""));
  for (const m of code.matchAll(/\blambda\s+([^:]*):/g)) add(m[1]);
  for (const m of code.matchAll(/\bfor\s+([\w\s,()]+?)\s+in\b/g)) add(m[1]);
  for (const m of code.matchAll(/\bas\s+(\w+)/g)) add(m[1]);
  for (const m of code.matchAll(/^[ \t]*([\w \t,]+?)\s*(?:[+\-*/%]?=)(?!=)/gm)) add(m[1]);
  const names = [...defined].sort();
  const map = new Map(names.map((n, i) => [n, r() < 0.8 ? `${["val", "tmp", "item", "data", "res"][i % 5]}${i + 1}` : n]));
  const ren = (t) => t.replace(ID, (n) => map.get(n) ?? n);
  return pyPieces(s)
    .map((p) => (isFString(p) ? p.replace(/\{([^{}]*)\}/g, (_, e) => "{" + ren(e) + "}") : isLiteral(p) ? p : ren(p)))
    .join("");
};

// Reorder the top-level function definitions (the rest stays after them, in its order).
const codeL3 = (s, r) => {
  const lines = s.split("\n");
  const blocks = [];
  let cur = null;
  const rest = [];
  for (const line of lines) {
    if (/^def\s/.test(line)) blocks.push((cur = [line]));
    else if (cur && (/^\s/.test(line) || line === "")) cur.push(line);
    else {
      cur = null;
      rest.push(line);
    }
  }
  if (blocks.length < 2) return s;
  return [...shuffle(blocks, r).map((b) => b.join("\n").replace(/\n+$/, "")), "", ...rest].join("\n\n").replace(/\n{3,}/g, "\n\n");
};

const LEVELS = {
  text: { L1: [textL1], L2: [textL1, textL2], L3: [textL1, textL2, textL3] },
  code: { L1: [codeL1], L2: [codeL1, codeL2], L3: [codeL1, codeL2, codeL3] },
};

// ---------- build ----------
const origDir = path.join(dir, "originals");
const l4Dir = path.join(dir, "l4");
const outDir = path.join(dir, "submissions");
fs.rmSync(outDir, { recursive: true, force: true });
const originals = fs.readdirSync(origDir).filter((f) => /^[A-Z]\d+_[A-Z]\d+\.(txt|py)$/.test(f)).sort();
if (!originals.length) throw new Error(`no originals like T1_H1.txt in ${origDir}`);

const pairs = [["task", "a", "b", "label", "level"]];
const byTask = new Map();
for (const f of originals) {
  const task = f.split("_")[0];
  if (!byTask.has(task)) byTask.set(task, []);
  byTask.get(task).push(f);
}
for (const [task, files] of byTask) {
  const tdir = path.join(outDir, task);
  fs.mkdirSync(tdir, { recursive: true });
  for (const f of files) fs.copyFileSync(path.join(origDir, f), path.join(tdir, f));
  // Independently written answers to the same task: every pair is "not copied".
  for (let i = 0; i < files.length; i++) for (let j = i + 1; j < files.length; j++) pairs.push([task, files[i], files[j], "0", "independent"]);
  for (const f of files) {
    const [stem, ext] = f.split(".");
    if (!SOURCES.includes(stem.split("_")[1])) continue;
    const kind = ext === "py" ? "code" : "text";
    const src = fs.readFileSync(path.join(origDir, f), "utf8");
    const out = { L0: src };
    for (const [lvl, steps] of Object.entries(LEVELS[kind])) {
      const r = rng(hash(`${stem}:${lvl}`));
      out[lvl] = steps.reduce((acc, step) => step(acc, r), src);
    }
    const l4 = path.join(l4Dir, `${stem}_L4.${ext}`);
    if (fs.existsSync(l4)) out.L4 = fs.readFileSync(l4, "utf8");
    for (const [lvl, body] of Object.entries(out)) {
      const name = `${stem}_${lvl}.${ext}`;
      fs.writeFileSync(path.join(tdir, name), body);
      pairs.push([task, f, name, "1", lvl]);
    }
  }
}
fs.writeFileSync(path.join(dir, "pairs.csv"), pairs.map((r) => r.join(",")).join("\n") + "\n");
const counts = pairs.slice(1).reduce((m, p) => ((m[p[4]] = (m[p[4]] ?? 0) + 1), m), {});
console.log(`seed ${SEED}; ${originals.length} originals; pairs:`, counts);
