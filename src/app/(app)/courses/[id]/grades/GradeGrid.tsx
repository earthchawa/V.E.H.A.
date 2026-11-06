"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { computeStudent, formatPct, type GCategory, type ScaleRow } from "@/lib/grades";
import { useI18n } from "@/lib/i18n/client";
import { FormMessage } from "@/components/FormMessage";
import type { FormState } from "@/lib/form";
import { saveGradesAction } from "./actions";
import { InfoTip } from "@/components/InfoTip";

type Item = { id: string; title: string; maxPoints: number; categoryId: string | null; isReleased: boolean };
type Student = { id: string; username: string; fullName: string };

const key = (itemId: string, studentId: string) => `${itemId}:${studentId}`;
const parse = (s: string): number | null | "bad" => {
  const v = s.trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : "bad";
};

/** Spreadsheet-style score entry with live totals. Only changed cells are sent on save. */
export function GradeGrid({
  offeringId,
  categories,
  items,
  students,
  initial,
  scale,
  readOnly = false,
}: {
  offeringId: string;
  categories: GCategory[];
  items: Item[];
  students: Student[];
  initial: Record<string, number | null>;
  scale: ScaleRow[];
  /** Admins: view only. */
  readOnly?: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState<Record<string, number | null>>(initial);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, v == null ? "" : String(v)])),
  );
  const [state, setState] = useState<FormState>(undefined);
  const catName = new Map(categories.map((c) => [c.id, c.name]));

  const cell = (itemId: string, studentId: string) => {
    const raw = values[key(itemId, studentId)] ?? "";
    const p = parse(raw);
    const item = items.find((i) => i.id === itemId)!;
    const invalid = p === "bad" || (typeof p === "number" && (p < 0 || p > item.maxPoints));
    const dirty = !invalid && (p as number | null) !== (saved[key(itemId, studentId)] ?? null);
    return { raw, p, invalid, dirty };
  };

  const changes = useMemo(() => {
    const out: { itemId: string; studentId: string; points: number | null }[] = [];
    let invalid = 0;
    for (const s of students)
      for (const i of items) {
        const c = cell(i.id, s.id);
        if (c.invalid) invalid++;
        else if (c.dirty) out.push({ itemId: i.id, studentId: s.id, points: c.p as number | null });
      }
    return { out, invalid };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, saved, items, students]);

  const totals = useMemo(
    () =>
      new Map(
        students.map((s) => {
          const pts = new Map(items.map((i) => {
            const p = parse(values[key(i.id, s.id)] ?? "");
            return [i.id, typeof p === "number" ? p : null] as const;
          }));
          return [s.id, computeStudent(categories, items, pts, { scale })];
        }),
      ),
    [values, students, items, categories, scale],
  );

  const save = () =>
    startTransition(async () => {
      const result = await saveGradesAction(offeringId, changes.out);
      setState(result);
      if (result?.success) {
        setSaved((prev) => {
          const next = { ...prev };
          for (const c of changes.out) next[key(c.itemId, c.studentId)] = c.points;
          return next;
        });
        router.refresh();
      }
    });

  const move = (e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) => {
    const delta = e.key === "Enter" || e.key === "ArrowDown" ? [1, 0] : e.key === "ArrowUp" ? [-1, 0] : null;
    if (!delta) return;
    e.preventDefault();
    document.querySelector<HTMLInputElement>(`[data-cell="${row + delta[0]}-${col + delta[1]}"]`)?.focus();
  };

  if (!students.length) return <p className="text-sm text-muted">{t("gr.noStudents")}</p>;
  if (!items.length) return <p className="text-sm text-muted">{t("gr.noItems")}</p>;

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="table text-[13px]" data-testid="gradebook">
          <thead>
            <tr>
              <th className="sticky left-0 z-[1] min-w-52 bg-surface pl-4">{t("asg.cadet")}</th>
              {items.map((i) => (
                <th key={i.id} className="min-w-28 align-bottom">
                  <div className="max-w-36 truncate text-fg" title={i.title}>{i.title}</div>
                  <div className="font-normal text-subtle">
                    /{i.maxPoints}
                    {i.categoryId && <> · {catName.get(i.categoryId)}</>}
                  </div>
                  {!i.isReleased && <span className="badge mt-1 bg-surface-3 font-normal text-muted">{t("gr.hidden")}</span>}
                </th>
              ))}
              <th className="min-w-20 text-right">{t("gr.total")}</th>
              <th className="min-w-16 pr-4 text-right">{t("gr.letter")}</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, row) => {
              const total = totals.get(s.id)!;
              return (
                <tr key={s.id}>
                  <td className="sticky left-0 z-[1] bg-surface pl-4">
                    <span className="font-mono text-xs text-subtle">{s.username}</span> {s.fullName}
                  </td>
                  {items.map((i, col) => {
                    const c = cell(i.id, s.id);
                    return (
                      <td key={i.id} className="py-1.5">
                        <input
                          inputMode="decimal"
                          data-cell={`${row}-${col}`}
                          aria-label={`${s.fullName} — ${i.title}`}
                          value={c.raw}
                          readOnly={readOnly}
                          disabled={readOnly}
                          onChange={(e) => setValues((v) => ({ ...v, [key(i.id, s.id)]: e.target.value }))}
                          onKeyDown={(e) => move(e, row, col)}
                          className={`input h-8 w-20 px-2 py-0 text-right font-mono text-[13px] ${
                            c.invalid ? "border-red-500/60 ring-2 ring-red-500/20" : c.dirty ? "border-accent/60 bg-accent/5" : ""
                          }`}
                        />
                      </td>
                    );
                  })}
                  <td className="text-right font-mono" data-testid="total">{formatPct(total.totalPct)}</td>
                  <td className="pr-4 text-right font-semibold" data-testid="letter">{total.letter ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!readOnly && <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className="btn" onClick={save} disabled={pending || changes.out.length === 0 || changes.invalid > 0}>
          {pending ? t("gr.saving") : t("gr.save")}
        </button>
        {changes.out.length > 0 && <span className="text-xs text-accent">{t("gr.unsaved", { n: changes.out.length })}</span>}
        <InfoTip text={t("gr.blankHint")} />
        <div className="w-full sm:w-auto"><FormMessage state={state} /></div>
      </div>}
    </div>
  );
}
