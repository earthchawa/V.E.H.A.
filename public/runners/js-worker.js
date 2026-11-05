/* Runs cadets' JavaScript (console programs) in a worker; a fresh worker is used for every run. */
self.onmessage = (e) => {
  const { id, code } = e.data || {};
  const fmt = (v) => {
    if (typeof v === "string") return v;
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  };
  const out = (stream) => (...args) => self.postMessage({ type: "out", id, stream, text: args.map(fmt).join(" ") + "\n" });
  console.log = console.info = console.debug = out("stdout");
  console.warn = console.error = out("stderr");
  const lineOf = (err) => {
    const m = String((err && err.stack) || "").match(/blob:[^\s)]*:(\d+):(\d+)/);
    return m ? Number(m[1]) : null;
  };
  self.addEventListener("error", (ev) => {
    self.postMessage({ type: "out", id, stream: "stderr", text: `${ev.message}${ev.lineno ? ` (main.js line ${ev.lineno})` : ""}\n` });
    ev.preventDefault();
  });
  self.addEventListener("unhandledrejection", (ev) => {
    const r = ev.reason;
    self.postMessage({ type: "out", id, stream: "stderr", text: `Uncaught (in promise) ${r && r.name ? `${r.name}: ${r.message}` : fmt(r)}\n` });
  });
  const started = performance.now();
  const url = URL.createObjectURL(new Blob([String(code || "")], { type: "text/javascript" }));
  try {
    importScripts(url);
    // Give timers / promises a moment so their output shows before "done".
    setTimeout(() => self.postMessage({ type: "done", id, ok: true, ms: Math.round(performance.now() - started) }), 300);
  } catch (err) {
    const line = lineOf(err);
    self.postMessage({
      type: "done",
      id,
      ok: false,
      error: `${err && err.name ? `${err.name}: ${String(err.message).replace(/^Failed to execute 'importScripts' on 'WorkerGlobalScope': /, "")}` : String(err)}${line ? ` (main.js line ${line})` : ""}`,
      ms: Math.round(performance.now() - started),
    });
  } finally {
    URL.revokeObjectURL(url);
  }
};
