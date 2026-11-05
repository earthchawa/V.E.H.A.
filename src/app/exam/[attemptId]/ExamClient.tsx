"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import type { Response } from "@/lib/quiz";
import { isBlankCode, type CodeFiles, type CodeLanguage } from "@/lib/code";
import { CodeWorkspace } from "@/components/code/CodeWorkspace";
import { logEventsAction, saveAnswerAction, submitAttemptAction } from "../actions";

export type ExamQuestion = {
  id: string;
  type: "SINGLE" | "MULTIPLE" | "SHORT" | "ESSAY" | "CODE";
  prompt: string;
  points: number;
  codeAnswer: boolean;
  language: CodeLanguage | null;
  starter: CodeFiles;
  options: { id: string; text: string }[];
};

type SaveState = "idle" | "saving" | "saved" | "offline";

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return (h ? `${h}:${String(m).padStart(2, "0")}` : String(m)) + ":" + String(sec).padStart(2, "0");
};

const isAnswered = (r: Response | undefined) => !!r && ((r.choice?.length ?? 0) > 0 || !!r.text?.trim() || !isBlankCode(r.files));

export function ExamClient({
  attemptId,
  questions,
  initial,
  deadline,
  serverNow,
  doneHref,
}: {
  attemptId: string;
  questions: ExamQuestion[];
  initial: Record<string, Response>;
  deadline: string | null;
  serverNow: string;
  doneHref: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, Response>>(initial);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [left, setLeft] = useState<number | null>(null);
  const [fsNeeded, setFsNeeded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // In-page confirmation: window.confirm() would blur the window and log a false "left the quiz".
  const [confirming, setConfirming] = useState(false);

  // Queued work: answers waiting to be saved, integrity events waiting to be sent.
  const pending = useRef(new Map<string, Response>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const events = useRef<{ type: string; at: number }[]>([]);
  const finished = useRef(false);
  // Server clock offset so the countdown matches the server's deadline.
  const offset = useRef(new Date(serverNow).getTime() - Date.now());

  const flushEvents = useCallback(() => {
    if (!events.current.length || finished.current) return;
    const batch = events.current.splice(0);
    logEventsAction(attemptId, batch).catch(() => events.current.unshift(...batch));
  }, [attemptId]);

  const record = useCallback((type: string) => {
    events.current.push({ type, at: Date.now() });
  }, []);

  const saveNow = useCallback(
    async (qid: string) => {
      const response = pending.current.get(qid);
      if (!response || finished.current) return;
      setSaveState("saving");
      try {
        const r = await saveAnswerAction(attemptId, qid, response);
        if (r.ok) {
          if (pending.current.get(qid) === response) pending.current.delete(qid);
          setSaveState(pending.current.size ? "saving" : "saved");
        } else if (r.reason === "closed") {
          finished.current = true;
          router.replace(doneHref);
        } else setSaveState("offline");
      } catch {
        setSaveState("offline");
      }
    },
    [attemptId, doneHref, router],
  );

  const update = (qid: string, response: Response) => {
    setAnswers((a) => ({ ...a, [qid]: response }));
    pending.current.set(qid, response);
    setSaveState("saving");
    clearTimeout(timers.current.get(qid));
    timers.current.set(qid, setTimeout(() => saveNow(qid), 700));
  };

  const submit = useCallback(
    async (auto: boolean) => {
      if (finished.current) return;
      setSubmitting(true);
      for (const qid of [...pending.current.keys()]) await saveNow(qid);
      flushEvents();
      finished.current = true;
      await submitAttemptAction(attemptId).catch(() => undefined);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
      router.replace(doneHref + (auto ? "?auto=1" : ""));
    },
    [attemptId, doneHref, flushEvents, router, saveNow],
  );

  // Countdown; submit automatically at the deadline.
  useEffect(() => {
    if (!deadline) return;
    const end = new Date(deadline).getTime();
    const tick = () => {
      const ms = end - (Date.now() + offset.current);
      setLeft(ms);
      if (ms <= 0) submit(true);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline, submit]);

  // Retry unsaved answers while offline; send integrity events regularly.
  useEffect(() => {
    const id = setInterval(() => {
      for (const qid of pending.current.keys()) if (!timers.current.has(qid) || saveState === "offline") saveNow(qid);
      flushEvents();
    }, 4000);
    return () => clearInterval(id);
  }, [flushEvents, saveNow, saveState]);

  // Integrity monitoring.
  useEffect(() => {
    // Clicking into a code question's preview (an iframe on this page) moves focus out of the window;
    // that is not leaving the quiz.
    const onBlur = () =>
      setTimeout(() => {
        const a = document.activeElement;
        if (a instanceof HTMLIFrameElement && a.dataset.runPreview) return;
        record("blur");
      }, 0);
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        record("hidden");
        flushEvents();
      }
    };
    const onFs = () => {
      if (!document.fullscreenElement && document.fullscreenEnabled && !finished.current) {
        record("fullscreen_exit");
        setFsNeeded(true);
      }
    };
    // Capture phase + stopPropagation so the code editor's own clipboard and drop handlers never run.
    const block = (type: string) => (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      record(type);
    };
    const onCopy = block("copy");
    const onPaste = block("paste");
    const onCut = block("copy");
    const onMenu = block("contextmenu");
    const onDrop = block("paste");
    const cap = { capture: true };
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVis);
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("copy", onCopy, cap);
    document.addEventListener("cut", onCut, cap);
    document.addEventListener("paste", onPaste, cap);
    document.addEventListener("drop", onDrop, cap);
    document.addEventListener("contextmenu", onMenu, cap);
    const warn = (e: BeforeUnloadEvent) => {
      if (!finished.current && pending.current.size) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    if (document.fullscreenEnabled && !document.fullscreenElement) setFsNeeded(true);
    return () => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("copy", onCopy, cap);
      document.removeEventListener("cut", onCut, cap);
      document.removeEventListener("paste", onPaste, cap);
      document.removeEventListener("drop", onDrop, cap);
      document.removeEventListener("contextmenu", onMenu, cap);
      window.removeEventListener("beforeunload", warn);
    };
  }, [flushEvents, record]);

  const enterFullscreen = () => {
    document.documentElement.requestFullscreen?.().then(() => setFsNeeded(false)).catch(() => setFsNeeded(false));
  };

  const answeredCount = questions.filter((q) => isAnswered(answers[q.id])).length;
  const unanswered = questions.length - answeredCount;
  const onSubmitClick = () => setConfirming(true);
  const lowTime = left != null && left < 5 * 60_000;

  return (
    <div className="select-none">
      {/* Sticky status bar */}
      <div className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <span className="text-xs text-muted" data-testid="answered">{t("qz.answered", { n: answeredCount, total: questions.length })}</span>
          <span className={`text-xs ${saveState === "offline" ? "text-danger" : "text-subtle"}`} data-testid="save-state">
            {saveState === "saving" ? t("qz.saving") : saveState === "saved" ? t("qz.saved") : saveState === "offline" ? t("qz.offline") : ""}
          </span>
          {left != null && (
            <span className={`ml-auto font-mono text-lg font-semibold ${lowTime ? "text-danger" : ""}`} data-testid="timer" aria-label={t("qz.timeLeft")}>
              {fmt(left)}
            </span>
          )}
          <button type="button" onClick={onSubmitClick} disabled={submitting} className={`btn h-8 ${left == null ? "ml-auto" : ""}`}>
            {t("qz.submit")}
          </button>
        </div>
        <nav className="mx-auto flex max-w-3xl flex-wrap gap-1 px-4 pb-2.5">
          {questions.map((q, i) => (
            <a
              key={q.id}
              href={`#q-${q.id}`}
              className={`grid h-7 w-7 place-items-center rounded-md text-xs transition ${
                isAnswered(answers[q.id]) ? "bg-accent/20 text-accent" : "bg-surface-3 text-muted hover:text-fg"
              }`}
            >
              {i + 1}
            </a>
          ))}
        </nav>
      </div>

      <ol className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        {questions.map((q, i) => {
          const r = answers[q.id] ?? {};
          return (
            <li key={q.id} id={`q-${q.id}`} className="card scroll-mt-32" data-testid="question">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <span className="text-xs font-semibold text-accent">{t("qz.question", { n: i + 1 })}</span>
                <span className="text-xs text-subtle">{t("qz.pts", { n: q.points })}</span>
              </div>
              <div className="mb-4 whitespace-pre-wrap text-[15px] leading-7">{q.prompt}</div>

              {(q.type === "SINGLE" || q.type === "MULTIPLE") && (
                <div className="space-y-2">
                  {q.options.map((o) => {
                    const picked = r.choice?.includes(o.id) ?? false;
                    return (
                      <label
                        key={o.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${
                          picked ? "border-accent/60 bg-accent/10" : "border-border hover:bg-surface-2"
                        }`}
                      >
                        <input
                          type={q.type === "SINGLE" ? "radio" : "checkbox"}
                          name={`q-${q.id}`}
                          checked={picked}
                          onChange={(e) => {
                            const cur = r.choice ?? [];
                            const next = q.type === "SINGLE" ? [o.id] : e.target.checked ? [...cur, o.id] : cur.filter((x) => x !== o.id);
                            update(q.id, { choice: next });
                          }}
                          className="mt-1 accent-accent"
                        />
                        <span className="whitespace-pre-wrap">{o.text}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              {q.type === "SHORT" && (
                <input
                  value={r.text ?? ""}
                  onChange={(e) => update(q.id, { text: e.target.value })}
                  className="input select-text"
                  aria-label={t("qz.yourAnswer")}
                  autoComplete="off"
                  spellCheck={false}
                />
              )}
              {q.type === "ESSAY" && (
                <textarea
                  value={r.text ?? ""}
                  onChange={(e) => update(q.id, { text: e.target.value })}
                  rows={q.codeAnswer ? 12 : 8}
                  className={`input select-text ${q.codeAnswer ? "font-mono text-[13px]" : ""}`}
                  aria-label={t("qz.yourAnswer")}
                  spellCheck={!q.codeAnswer}
                  onKeyDown={(e) => {
                    // Tab inserts spaces in code answers instead of leaving the box.
                    if (q.codeAnswer && e.key === "Tab") {
                      e.preventDefault();
                      const el = e.currentTarget;
                      const { selectionStart: s, selectionEnd: en, value } = el;
                      const next = value.slice(0, s) + "    " + value.slice(en);
                      update(q.id, { text: next });
                      requestAnimationFrame(() => el.setSelectionRange(s + 4, s + 4));
                    }
                  }}
                />
              )}
              {q.type === "CODE" && q.language && (
                <CodeWorkspace
                  idPrefix={q.id}
                  language={q.language}
                  files={r.files ?? q.starter}
                  onChange={(files) => update(q.id, { files })}
                />
              )}
            </li>
          );
        })}
      </ol>

      <div className="mx-auto max-w-3xl px-4 pb-16">
        <button type="button" onClick={onSubmitClick} disabled={submitting} className="btn w-full">{t("qz.submit")}</button>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-bg/80 px-4 backdrop-blur" role="dialog" aria-modal="true" data-testid="submit-dialog">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 text-center">
            <p className="text-sm">{unanswered ? t("qz.unansweredConfirm", { n: unanswered }) : t("qz.submitConfirm")}</p>
            <div className="mt-5 flex justify-center gap-3">
              <button type="button" className="btn-secondary h-9" onClick={() => setConfirming(false)}>{t("qz.cancel")}</button>
              <button type="button" className="btn" disabled={submitting} onClick={() => submit(false)} data-testid="confirm-submit">{t("qz.submit")}</button>
            </div>
          </div>
        </div>
      )}
      {fsNeeded && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-bg/95 px-4 backdrop-blur" data-testid="fullscreen-overlay">
          <div className="max-w-sm text-center">
            <p className="mb-4 text-sm text-muted">{t("qz.rule.integrity")}</p>
            <button type="button" className="btn" onClick={enterFullscreen}>{t("qz.fullscreen")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
