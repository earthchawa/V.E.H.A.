// Copies the Python runtime (Pyodide) from node_modules into public/pyodide so quiz code questions can
// run Python in the browser without any external CDN. Runs before `dev` and `build`.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const src = dirname(require.resolve("pyodide/package.json"));
const { version } = JSON.parse(readFileSync(join(src, "package.json"), "utf8"));
const out = join(process.cwd(), "public", "pyodide");
const stamp = join(out, "VERSION");
if (existsSync(stamp) && readFileSync(stamp, "utf8").trim() === version) process.exit(0);
mkdirSync(out, { recursive: true });
for (const f of ["pyodide.js", "pyodide.asm.js", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"]) {
  copyFileSync(join(src, f), join(out, f));
}
writeFileSync(stamp, version + "\n");
console.log(`[pyodide] copied ${version} to public/pyodide`);
