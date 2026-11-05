"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { PREVIEW_TAG, buildWebDocument, cleanTraceback, type CodeFiles, type CodeLanguage } from "@/lib/code";

type Line = { stream: "stdout" | "stderr" | "info"; text: string };

/** Seconds a run may take before it is stopped (infinite loops). */
const TIME_LIMIT_S = 10;
const MAX_OUTPUT = 100_000;

/**
 * Runs code entirely in the browser: Python with Pyodide in a worker, JavaScript in a worker,
 * HTML/CSS/JS in a sandboxed iframe (no access to the page, cookies or the cadet's session).
 * Nothing is executed on the server.
 */
export function CodeRunner({ language, files, testId }: { language: CodeLanguage; files: CodeFiles; testId?: string }) {
  const { t } = useI18n();
  const [lines, setLines] = useState<Line[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "running" | "done" | "error" | "timeout">("idle");
  const [ms, setMs] = useState<number | null>(null);
  const [stdin, setStdin] = useState("");
  const [preview, setPreview] = useState<{ html: string; key: number } | null>(null);
  const worker = useRef<Worker | null>(null);
  const pyReady = useRef(false);
  const runId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const webMeta = useRef<{ token: string; jsLine: number } | null>(null);
  const size = useRef(0);

  const push = (l: Line) => {
    if (size.current > MAX_OUTPUT) return;
    size.current += l.text.length;
    setLines((ls) => {
      // Merge consecutive chunks of the same stream so output reads naturally.
      const last = ls[ls.length - 1];
      const text = size.current > MAX_OUTPUT ? l.text + `\n… ${t("code.outputCut")}\n` : l.text;
      if (last && last.stream === l.stream) return [...ls.slice(0, -1), { ...last, text: last.text + text }];
      return [...ls, { ...l, text }];
    });
  };

  const stopWorker = () => {
    worker.current?.terminate();
    worker.current = null;
    pyReady.current = false;
  };
  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => () => {
    clearTimer();
    stopWorker();
  }, []);

  // Messages from the web preview iframe (console output and errors).
  useEffect(() => {
    if (language !== "web") return;
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (!d || d.tag !== PREVIEW_TAG || !webMeta.current || d.token !== webMeta.current.token) return;
      if (d.level === "error") {
        const err = typeof d.text === "object" ? d.text : { message: String(d.text) };
        const line = err.line ? err.line - webMeta.current.jsLine + 1 : null;
        push({ stream: "stderr", text: `${err.message}${line && line > 0 ? ` (script.js ${t("code.line", { n: line })})` : ""}\n` });
      } else push({ stream: d.level === "log" ? "stdout" : "stderr", text: String(d.text) + "\n" });
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const finish = (ok: boolean, took: number | null, error?: string) => {
    clearTimer();
    if (error) push({ stream: "stderr", text: (language === "python" ? cleanTraceback(error) : error) + "\n" });
    setMs(took);
    setStatus(ok ? "done" : "error");
  };

  const run = () => {
    clearTimer();
    setLines([]);
    size.current = 0;
    setMs(null);
    const id = ++runId.current;

    if (language === "web") {
      const token = Math.random().toString(36).slice(2);
      const doc = buildWebDocument(files, token);
      webMeta.current = { token, jsLine: doc.jsLine };
      setPreview({ html: doc.html, key: id });
      setStatus("done");
      return;
    }

    if (language === "javascript") stopWorker(); // fresh global scope every run
    if (!worker.current) {
      worker.current = new Worker(language === "python" ? "/runners/python-worker.js" : "/runners/js-worker.js");
      pyReady.current = language !== "python";
    }
    const w = worker.current;
    setStatus(pyReady.current ? "running" : "loading");
    w.onmessage = (e: MessageEvent) => {
      const d = e.data;
      if (d.type === "ready") {
        pyReady.current = true;
        setStatus("running");
        startTimer(id);
        return;
      }
      if (d.type === "fatal") return finish(false, null, t("code.loadFailed"));
      if (d.id !== runId.current) return;
      if (d.type === "out") push({ stream: d.stream, text: d.text });
      if (d.type === "done") finish(d.ok, d.ms, d.ok ? undefined : d.error);
    };
    w.onerror = (e) => {
      e.preventDefault();
      finish(false, null, e.message || t("code.loadFailed"));
    };
    const code = language === "python" ? files["main.py"] ?? "" : files["main.js"] ?? "";
    w.postMessage({ id, code, stdin });
    if (pyReady.current) startTimer(id);
  };

  // The time limit starts once the runtime is loaded (the first Python load can take a few seconds).
  const startTimer = (id: number) => {
    clearTimer();
    timer.current = setTimeout(() => {
      if (id !== runId.current) return;
      stopWorker();
      push({ stream: "stderr", text: t("code.timeout", { n: TIME_LIMIT_S }) + "\n" });
      setStatus("timeout");
    }, TIME_LIMIT_S * 1000);
  };

  const stop = () => {
    runId.current++;
    clearTimer();
    stopWorker();
    push({ stream: "info", text: t("code.stopped") + "\n" });
    setStatus("idle");
  };

  const busy = status === "loading" || status === "running";
  const statusText =
    status === "loading" ? t("code.loading") : status === "running" ? t("code.running") : status === "error" ? t("code.failed") : status === "timeout" ? t("code.timedOut") : status === "done" && ms != null ? t("code.finished", { ms }) : "";

  return (
    <div className="space-y-2" data-testid={testId ?? "code-runner"}>
      {language === "python" && (
        <details className="text-xs text-muted">
          <summary className="cursor-pointer select-none">{t("code.stdin")}</summary>
          <textarea
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            rows={3}
            className="input mt-1.5 select-text font-mono text-xs"
            placeholder={t("code.stdinHint")}
            aria-label={t("code.stdin")}
            data-testid="code-stdin"
            spellCheck={false}
          />
        </details>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn h-8 px-3 text-xs" onClick={run} disabled={busy} data-testid="code-run">
          ▶ {language === "web" ? t("code.preview") : t("code.run")}
        </button>
        {busy && (
          <button type="button" className="btn-secondary" onClick={stop} data-testid="code-stop">■ {t("code.stop")}</button>
        )}
        <span className={`text-xs ${status === "error" || status === "timeout" ? "text-danger" : "text-subtle"}`} data-testid="code-status">
          {statusText}
        </span>
      </div>
      {language === "web" && preview && (
        <iframe
          key={preview.key}
          title={t("code.preview")}
          sandbox="allow-scripts"
          srcDoc={preview.html}
          data-run-preview="1"
          data-testid="code-preview"
          className="h-72 w-full rounded-lg border border-border bg-white"
        />
      )}
      {(lines.length > 0 || language !== "web") && (
        <pre
          className="max-h-72 min-h-16 overflow-auto rounded-lg border border-border bg-bg p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words select-text"
          aria-live="polite"
          aria-label={t("code.output")}
          data-testid="code-output"
        >
          {lines.length === 0 ? (
            <span className="text-subtle">{t("code.outputEmpty")}</span>
          ) : (
            lines.map((l, i) => (
              <span key={i} className={l.stream === "stderr" ? "text-danger" : l.stream === "info" ? "text-subtle" : "text-fg"}>
                {l.text}
              </span>
            ))
          )}
        </pre>
      )}
    </div>
  );
}
