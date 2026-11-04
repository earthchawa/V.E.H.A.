"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { QuestionEditor, type QuestionDraft } from "./QuestionEditor";
import { deleteQuestionAction, moveQuestionAction } from "./actions";

/** Instructor view of the quiz's questions with inline editing. */
export function QuestionList({ quizId, questions }: { quizId: string; questions: (QuestionDraft & { id: string })[] }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<string | null>(null);
  if (!questions.length) return <p className="text-sm text-muted">{t("qz.noQuestions")}</p>;
  return (
    <ol className="space-y-3">
      {questions.map((q, i) => (
        <li key={q.id} className="rounded-xl border border-border bg-surface p-4" data-testid="builder-question">
          {editing === q.id ? (
            <QuestionEditor quizId={quizId} draft={q} onDone={() => setEditing(null)} />
          ) : (
            <>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-xs font-semibold text-accent">{t("qz.question", { n: i + 1 })}</span>
                <span className="badge bg-surface-3 text-muted">{t(`qz.type.${q.type}`)}</span>
                <span className="text-xs text-subtle">{t("qz.pts", { n: q.points })}</span>
                <div className="ml-auto flex items-center gap-1">
                  {(["up", "down"] as const).map((dir) => (
                    <form key={dir} action={moveQuestionAction}>
                      <input type="hidden" name="questionId" value={q.id} />
                      <input type="hidden" name="dir" value={dir} />
                      <button
                        className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface-3 hover:text-fg disabled:opacity-30"
                        disabled={(dir === "up" && i === 0) || (dir === "down" && i === questions.length - 1)}
                        aria-label={t(dir === "up" ? "qz.moveUp" : "qz.moveDown")}
                      >
                        {dir === "up" ? "↑" : "↓"}
                      </button>
                    </form>
                  ))}
                  <button type="button" onClick={() => setEditing(q.id)} className="btn-secondary h-7">{t("qz.edit")}</button>
                  <form action={deleteQuestionAction} onSubmit={(e) => { if (!confirm(t("qz.deleteQuestionConfirm"))) e.preventDefault(); }}>
                    <input type="hidden" name="questionId" value={q.id} />
                    <button className="btn-danger h-7">{t("qz.delete")}</button>
                  </form>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{q.prompt}</p>
              {q.options.length > 0 && (q.type === "SINGLE" || q.type === "MULTIPLE") && (
                <ul className="mt-2 space-y-1 text-sm">
                  {q.options.map((o) => (
                    <li key={o.id} className={o.correct ? "text-success" : "text-muted"}>{o.correct ? "✓" : "○"} {o.text}</li>
                  ))}
                </ul>
              )}
              {q.type === "SHORT" && q.accepted.length > 0 && (
                <p className="mt-2 text-xs text-muted">{t("qz.correctAnswer")}: <span className="text-success">{q.accepted.join(" · ")}</span></p>
              )}
            </>
          )}
        </li>
      ))}
    </ol>
  );
}
