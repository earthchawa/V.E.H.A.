/**
 * Code questions: languages, their files, and how answers are cleaned and laid out for running.
 * Pure (no DOM / DB) so it can be shared by the server, the exam page and tests.
 */
export const CODE_LANGUAGES = ["python", "javascript", "web"] as const;
export type CodeLanguage = (typeof CODE_LANGUAGES)[number];
export type CodeFiles = Record<string, string>;

/** Files each language uses, in tab order. */
export const LANGUAGE_FILES: Record<CodeLanguage, string[]> = {
  python: ["main.py"],
  javascript: ["main.js"],
  web: ["index.html", "style.css", "script.js"],
};

/** Editor syntax mode for a file name. */
export function fileMode(name: string): "python" | "javascript" | "html" | "css" {
  if (name.endsWith(".py")) return "python";
  if (name.endsWith(".html")) return "html";
  if (name.endsWith(".css")) return "css";
  return "javascript";
}

export const MAX_FILE_CHARS = 50_000;

export function asLanguage(v: unknown): CodeLanguage {
  return (CODE_LANGUAGES as readonly string[]).includes(String(v)) ? (v as CodeLanguage) : "python";
}

/** Keep only this language's files, as strings, size-capped. */
export function cleanFiles(language: CodeLanguage, files: unknown): CodeFiles {
  const src = files && typeof files === "object" ? (files as Record<string, unknown>) : {};
  const out: CodeFiles = {};
  for (const name of LANGUAGE_FILES[language]) {
    const v = src[name];
    out[name] = typeof v === "string" ? v.slice(0, MAX_FILE_CHARS) : "";
  }
  return out;
}

export const isBlankCode = (files: CodeFiles | undefined | null) => !files || Object.values(files).every((v) => !v.trim());

/** Starter code for a new question of this language. */
export const DEFAULT_STARTER: Record<CodeLanguage, CodeFiles> = {
  python: { "main.py": "" },
  javascript: { "main.js": "" },
  web: {
    "index.html": "<h1>Hello</h1>\n",
    "style.css": "body {\n  font-family: sans-serif;\n}\n",
    "script.js": "",
  },
};

// ---------- web preview document ----------

/** Message tag used by the preview iframe to talk to the page. */
export const PREVIEW_TAG = "veha-run";

/**
 * Builds the srcdoc for an HTML/CSS/JS answer. A small script captures console output and errors and
 * posts them to the parent; script.js runs last, and `jsLine` is the document line it starts on so
 * errors can be reported as script.js line numbers.
 */
export function buildWebDocument(files: CodeFiles, token: string): { html: string; jsLine: number } {
  const esc = (s: string) => s.replace(/<\/(script)/gi, "<\\/$1");
  const capture = `<script>(function(){var T=${JSON.stringify(token)},P=function(l,a){try{parent.postMessage({tag:${JSON.stringify(
    PREVIEW_TAG,
  )},token:T,level:l,text:a},"*")}catch(e){}};var F=function(v){if(typeof v==="string")return v;try{return JSON.stringify(v)}catch(e){return String(v)}};["log","info","warn","error"].forEach(function(k){var o=console[k];console[k]=function(){P(k==="info"?"log":k,Array.prototype.map.call(arguments,F).join(" "));o&&o.apply(console,arguments)}});window.addEventListener("error",function(e){P("error",{message:e.message,line:e.lineno})});window.addEventListener("unhandledrejection",function(e){P("error",{message:"Unhandled promise rejection: "+F(e.reason&&e.reason.message||e.reason)})})})();</script>`;
  const head = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${capture}<style>\n${files["style.css"] ?? ""}\n</style></head><body>\n${files["index.html"] ?? ""}\n<script>\n`;
  const jsLine = head.split("\n").length;
  return { html: `${head}${esc(files["script.js"] ?? "")}\n</script></body></html>`, jsLine };
}

/**
 * Python traceback without Pyodide's own frames: keeps the header, frames in main.py and the error lines.
 */
export function cleanTraceback(tb: string): string {
  const lines = tb.replace(/\s+$/, "").split("\n");
  const out: string[] = [];
  let keep = true;
  for (const line of lines) {
    const frame = line.match(/^\s+File "([^"]+)"/);
    if (frame) keep = frame[1] === "main.py";
    else if (!/^\s/.test(line)) keep = true;
    if (keep) out.push(line);
  }
  return out.join("\n");
}
