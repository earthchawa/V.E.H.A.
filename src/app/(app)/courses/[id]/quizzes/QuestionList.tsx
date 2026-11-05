"use client";

import { useEffect, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/client";
import { Modal } from "@/components/Modal";
import { asLanguage } from "@/lib/code";
import { QuestionEditor, type QuestionDraft } from "./QuestionEditor";
import { deleteQuestionAction, moveQuestionAction, reorderQuestionsAction } from "./actions";

type Q = QuestionDraft & { id: string };

/** Instructor view of a quiz's questions: drag to reorder (↑/↓ for keyboard), edit in a modal. */
export function QuestionList({ quizId, questions }: { quizId: string; questions: Q[] }) {
  const { t } = useI18n();
  const [order, setOrder] = useState(questions);
  const [dragging, setDragging] = useState<string | null>(null);
  const [, start] = useTransition();
  useEffect(() => setOrder(questions), [questions]);

  if (!order.length) return <p className="text-sm text-muted">{t("qz.noQuestions")}</p>;

  const moveTo = (id: string, overId: string) => {
    if (id === overId) return;
    setOrder((cur) => {
      const from = cur.findIndex((q) => q.id === id);
      const to = cur.findIndex((q) => q.id === overId);
      const next = [...cur];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };
  const commit = () => {
    setDragging(null);
    const ids = order.map((q) => q.id);
    if (ids.join() !== questions.map((q) => q.id).join()) start(() => reorderQuestionsAction(quizId, ids));
  };

  return (
    <ol className="space-y-3">
      {order.map((q, i) => (
        <li
          key={q.id}
          draggable
          onDragStart={(e) => {
            setDragging(q.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (dragging) moveTo(dragging, q.id);
          }}
          onDragEnd={commit}
          onDrop={(e) => e.preventDefault()}
          className={`rounded-xl border bg-surface p-4 transition ${dragging === q.id ? "border-accent/60 opacity-60" : "border-border"}`}
          data-testid="builder-question"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="cursor-grab select-none text-subtle active:cursor-grabbing" title={t("qz.dragHint")} aria-hidden>⋮⋮</span>
            <span className="text-xs font-semibold text-accent">{t("qz.question", { n: i + 1 })}</span>
            <span className="badge bg-surface-3 text-muted">{t(`qz.type.${q.type}`)}</span>
            {q.type === "CODE" && q.language && <span className="badge bg-accent/10 text-accent">{t(`code.lang.${asLanguage(q.language)}`)}</span>}
            <span className="text-xs text-subtle">{t("qz.pts", { n: q.points })}</span>
            <div className="ml-auto flex items-center gap-1">
              {(["up", "down"] as const).map((dir) => (
                <form key={dir} action={moveQuestionAction}>
                  <input type="hidden" name="questionId" value={q.id} />
                  <input type="hidden" name="dir" value={dir} />
                  <button
                    className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface-3 hover:text-fg disabled:opacity-30"
                    disabled={(dir === "up" && i === 0) || (dir === "down" && i === order.length - 1)}
                    aria-label={t(dir === "up" ? "qz.moveUp" : "qz.moveDown")}
                  >
                    {dir === "up" ? "↑" : "↓"}
                  </button>
                </form>
              ))}
              <Modal label={t("qz.edit")} title={t("qz.question", { n: i + 1 })} buttonClassName="btn-secondary h-7" size="lg">
                <QuestionEditor quizId={quizId} draft={q} closeOnSuccess />
              </Modal>
              <form action={deleteQuestionAction} onSubmit={(e) => { if (!confirm(t("qz.deleteQuestionConfirm"))) e.preventDefault(); }}>
                <input type="hidden" name="questionId" value={q.id} />
                <button className="btn-danger h-7">{t("qz.delete")}</button>
              </form>
            </div>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm">{q.prompt}</p>
          {(q.type === "SINGLE" || q.type === "MULTIPLE") && (
            <ul className="mt-2 space-y-1 text-sm">
              {q.options.map((o) => (
                <li key={o.id} className={o.correct ? "text-success" : "text-muted"}>{o.correct ? "✓" : "○"} {o.text}</li>
              ))}
            </ul>
          )}
          {q.type === "SHORT" && q.accepted.length > 0 && (
            <p className="mt-2 text-xs text-muted">{t("qz.correctAnswer")}: <span className="text-success">{q.accepted.join(" · ")}</span></p>
          )}
        </li>
      ))}
    </ol>
  );
}
