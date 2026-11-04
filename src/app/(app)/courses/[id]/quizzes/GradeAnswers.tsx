"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { FormMessage } from "@/components/FormMessage";
import type { FormState } from "@/lib/form";
import { gradeAnswersAction } from "./actions";

export type GradeRow = {
  answerId: string;
  heading: React.ReactNode;
  body: React.ReactNode;
  maxPoints: number;
  points: number | null;
  feedback: string | null;
  autoGraded: boolean;
};

/** Points + feedback inputs for a list of answers; only changed rows are saved. */
export function GradeAnswers({ quizId, rows, readOnly = false }: { quizId: string; rows: GradeRow[]; readOnly?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState<FormState>(undefined);
  const [vals, setVals] = useState(() =>
    Object.fromEntries(rows.map((r) => [r.answerId, { points: r.points == null ? "" : String(r.points), feedback: r.feedback ?? "" }])),
  );

  const parsed = rows.map((r) => {
    const v = vals[r.answerId];
    const p = v.points.trim() === "" ? null : Number(v.points);
    const invalid = p != null && (!Number.isFinite(p) || p < 0 || p > r.maxPoints);
    const dirty = !invalid && (p !== r.points || (v.feedback.trim() || null) !== (r.feedback ?? null));
    return { r, p, invalid, dirty, feedback: v.feedback.trim() || null };
  });
  const changes = parsed.filter((x) => x.dirty);
  const anyInvalid = parsed.some((x) => x.invalid);

  const save = () =>
    start(async () => {
      const res = await gradeAnswersAction(quizId, changes.map((c) => ({ answerId: c.r.answerId, points: c.p, feedback: c.feedback })));
      setState(res);
      if (res?.success) router.refresh();
    });

  return (
    <div className="space-y-4">
      {parsed.map(({ r, invalid, dirty }) => (
        <div key={r.answerId} className="rounded-xl border border-border bg-surface p-4" data-testid="grade-row">
          <div className="mb-3 flex flex-wrap items-baseline gap-2">{r.heading}</div>
          {r.body}
          <div className="mt-3 grid gap-2 sm:grid-cols-[12rem_1fr]">
            <div className="flex items-center gap-2">
              <input
                inputMode="decimal"
                aria-label={t("gr.score")}
                value={vals[r.answerId].points}
                disabled={readOnly}
                onChange={(e) => setVals((v) => ({ ...v, [r.answerId]: { ...v[r.answerId], points: e.target.value } }))}
                className={`input h-9 w-20 text-right font-mono ${invalid ? "border-red-500/60" : dirty ? "border-accent/60 bg-accent/5" : ""}`}
              />
              <span className="whitespace-nowrap text-xs text-subtle">/ {r.maxPoints}</span>
              {r.autoGraded && <span className="badge bg-surface-3 text-muted">{t("qz.auto")}</span>}
            </div>
            <input
              aria-label={t("gr.feedback")}
              placeholder={t("gr.feedback")}
              value={vals[r.answerId].feedback}
              disabled={readOnly}
              onChange={(e) => setVals((v) => ({ ...v, [r.answerId]: { ...v[r.answerId], feedback: e.target.value } }))}
              className="input h-9"
            />
          </div>
        </div>
      ))}
      {!readOnly && <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-border bg-bg/90 py-3 backdrop-blur">
        <button type="button" className="btn" onClick={save} disabled={pending || !changes.length || anyInvalid}>
          {pending ? t("gr.saving") : t("gr.save")}
        </button>
        {changes.length > 0 && <span className="text-xs text-accent">{t("gr.unsaved", { n: changes.length })}</span>}
        <span className="text-xs text-subtle">{t("qz.gradeHint")}</span>
        <FormMessage state={state} />
      </div>}
    </div>
  );
}
