/* Runs cadets' Python in the browser with Pyodide (self-hosted under /pyodide). One run at a time;
   the page terminates this worker on timeout or "Stop" and starts a fresh one. */
/* global importScripts, loadPyodide */
importScripts("/pyodide/pyodide.js");

const ready = loadPyodide({ indexURL: "/pyodide/", fullStdLib: false }).then((py) => {
  self.postMessage({ type: "ready" });
  return py;
}, (e) => {
  self.postMessage({ type: "fatal", text: String((e && e.message) || e) });
  throw e;
});

// input() echoes the prompt and the line it read, like a terminal, and explains EOF in plain words.
const PRELUDE = `
def input(prompt=""):
    import sys
    print(prompt, end="")
    line = sys.stdin.readline()
    if not line:
        raise EOFError("input() needs more lines — type them in the Input box before running")
    line = line.rstrip("\\n")
    print(line)
    return line
`;

self.onmessage = async (e) => {
  const { id, code, stdin } = e.data || {};
  const py = await ready;
  const send = (stream, text) => self.postMessage({ type: "out", id, stream, text });
  const lines = String(stdin || "").split("\n").map((l) => l + "\n");
  if (lines.length && lines[lines.length - 1] === "\n") lines.pop();
  py.setStdout({ batched: (s) => send("stdout", s + "\n") });
  py.setStderr({ batched: (s) => send("stderr", s + "\n") });
  py.setStdin({ stdin: () => (lines.length ? lines.shift() : undefined) });
  const started = performance.now();
  const globals = py.globals.get("dict")();
  try {
    py.runPython(PRELUDE, { globals, filename: "<prelude>" });
    py.runPython(String(code || ""), { globals, filename: "main.py" });
    self.postMessage({ type: "done", id, ok: true, ms: Math.round(performance.now() - started) });
  } catch (err) {
    self.postMessage({ type: "done", id, ok: false, error: String((err && err.message) || err), ms: Math.round(performance.now() - started) });
  } finally {
    globals.destroy();
  }
};
