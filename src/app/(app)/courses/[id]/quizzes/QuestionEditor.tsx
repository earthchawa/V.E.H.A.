"use client";

import { useActionState, useEffect, useState } from "react";
import { KeepForm } from "@/components/KeepForm";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { useI18n } from "@/lib/i18n/client";
import type { Option, QType } from "@/lib/quiz";
import { CODE_LANGUAGES, DEFAULT_STARTER, LANGUAGE_FILES, asLanguage, type CodeLanguage } from "@/lib/code";
import { saveQuestionAction } from "./actions";
import { InfoTip } from "@/components/InfoTip";

export type QuestionDraft = {
  id: string | null;
  type: QType;
  prompt: string;
  points: number;
  options: Option[];
  accepted: string[];
  codeAnswer: boolean;
  language?: string | null;
  starter?: Record<string, string>;
};

export const NEW_QUESTION: QuestionDraft = {
  id: null,
  type: "SINGLE",
  prompt: "",
  points: 1,
  options: [
    { id: "", text: "", correct: true },
    { id: "", text: "", correct: false },
    { id: "", text: "", correct: false },
    { id: "", text: "", correct: false },
  ],
  accepted: [],
  codeAnswer: false,
};

/** Add / edit one question. Option rows are local state; the server re-validates everything. */
export function QuestionEditor({ quizId, draft = NEW_QUESTION, onDone, closeOnSuccess = false }: { quizId: string; draft?: QuestionDraft; onDone?: () => void; closeOnSuccess?: boolean }) {
  const [state, action, pending] = useActionState(saveQuestionAction.bind(null, quizId, draft.id), undefined);
  const { t } = useI18n();
  const [type, setType] = useState<QType>(draft.type);
  const [options, setOptions] = useState<Option[]>(draft.options.length ? draft.options : NEW_QUESTION.options);
  const choice = type === "SINGLE" || type === "MULTIPLE";
  const [language, setLanguage] = useState<CodeLanguage>(asLanguage(draft.language));
  const hasStarter = draft.type === "CODE" && draft.starter && Object.keys(draft.starter).length > 0;
  const starterFor = (lang: CodeLanguage, file: string) =>
    hasStarter && asLanguage(draft.language) === lang ? (draft.starter?.[file] ?? "") : (DEFAULT_STARTER[lang][file] ?? "");

  // After adding a question, start the next one from a clean slate; after editing, close the editor.
  useEffect(() => {
    if (!state?.success) return;
    if (draft.id) onDone?.();
    else {
      setType("SINGLE");
      setLanguage("python");
      setOptions(NEW_QUESTION.options);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const setCorrect = (i: number, on: boolean) =>
    setOptions((os) => os.map((o, k) => (type === "SINGLE" ? { ...o, correct: k === i } : k === i ? { ...o, correct: on } : o)));
  const trueFalse = () => {
    setType("SINGLE");
    setOptions([
      { id: "", text: t("qz.true"), correct: true },
      { id: "", text: t("qz.false"), correct: false },
    ]);
  };

  return (
    <KeepForm
      action={action}
      pending={pending}
      state={state}
      resetOnSuccess={!draft.id}
      closeOnSuccess={closeOnSuccess}
      className="space-y-4"
      key={draft.id ?? "new"}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
        <div>
          <label className="label" htmlFor={`qt-${draft.id}`}>{t("qz.type")}</label>
          <select id={`qt-${draft.id}`} name="type" className="input" value={type} onChange={(e) => setType(e.target.value as QType)}>
            {(["SINGLE", "MULTIPLE", "SHORT", "ESSAY", "CODE"] as const).map((k) => <option key={k} value={k}>{t(`qz.type.${k}`)}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`qp-${draft.id}`}>{t("qz.qpoints")}</label>
          <input id={`qp-${draft.id}`} name="points" inputMode="decimal" className="input" defaultValue={draft.points} required />
        </div>
      </div>
      <div>
        <label className="label" htmlFor={`qq-${draft.id}`}>{t("qz.prompt")}</label>
        <textarea id={`qq-${draft.id}`} name="prompt" rows={3} className="input" defaultValue={draft.prompt} required />
      </div>

      {choice && (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="label mb-0">{t("qz.options")}</span>
            <button type="button" onClick={trueFalse} className="text-xs text-accent hover:underline">{t("qz.trueFalse")}</button>
          </div>
          <ul className="space-y-2">
            {options.map((o, i) => (
              <li key={i} className="flex items-center gap-2">
                <input type="hidden" name="optId" value={o.id} />
                <input
                  type={type === "SINGLE" ? "radio" : "checkbox"}
                  name="optCorrect"
                  value={String(i)}
                  checked={o.correct}
                  onChange={(e) => setCorrect(i, e.target.checked)}
                  className="accent-accent"
                  aria-label={t("qz.correctAnswer")}
                />
                <input
                  name="optText"
                  value={o.text}
                  onChange={(e) => setOptions((os) => os.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))}
                  className="input h-9 flex-1"
                  placeholder={t("qz.option", { n: i + 1 })}
                  aria-label={t("qz.option", { n: i + 1 })}
                />
                {options.length > 2 && (
                  <button type="button" onClick={() => setOptions((os) => os.filter((_, k) => k !== i))} className="text-xs text-muted hover:text-danger">
                    {t("qz.removeOption")}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {options.length < 10 && (
            <button type="button" onClick={() => setOptions((os) => [...os, { id: "", text: "", correct: false }])} className="mt-2 text-xs text-accent hover:underline">
              + {t("qz.addOption")}
            </button>
          )}
        </div>
      )}
      {type === "SHORT" && (
        <div>
          <label className="label flex items-center gap-1.5" htmlFor={`qa-${draft.id}`}>{t("qz.accepted")} <InfoTip text={t("qz.acceptedHint")} align="start" /></label>
          <textarea id={`qa-${draft.id}`} name="accepted" rows={3} className="input" defaultValue={draft.accepted.join("\n")} />
        </div>
      )}
      {type === "ESSAY" && (
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="codeAnswer" defaultChecked={draft.codeAnswer} className="accent-accent" /> {t("qz.codeAnswer")}
        </label>
      )}
      {type === "CODE" && (
        <div className="space-y-3" data-testid="code-question-fields">
          <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs leading-relaxed text-muted">{t("qz.code.hint")}</p>
          <div>
            <label className="label" htmlFor={`ql-${draft.id}`}>{t("qz.code.language")}</label>
            <select id={`ql-${draft.id}`} name="language" className="input" value={language} onChange={(e) => setLanguage(e.target.value as CodeLanguage)}>
              {CODE_LANGUAGES.map((l) => <option key={l} value={l}>{t(`code.lang.${l}`)}</option>)}
            </select>
          </div>
          <div>
            <span className="label flex items-center gap-1.5">{t("qz.code.starter")} <InfoTip text={t("qz.code.starterHint")} align="start" /></span>
            <div className="space-y-2" key={language}>
              {LANGUAGE_FILES[language].map((f) => (
                <div key={f}>
                  <label className="mb-1 block font-mono text-[11px] text-subtle" htmlFor={`qs-${draft.id}-${f}`}>{f}</label>
                  <textarea
                    id={`qs-${draft.id}-${f}`}
                    name={`starter:${f}`}
                    rows={4}
                    className="input font-mono text-[13px]"
                    defaultValue={starterFor(language, f)}
                    spellCheck={false}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <FormMessage state={state} />
      <div className="flex items-center gap-3">
        <SubmitButton>{t(draft.id ? "qz.saveQuestion" : "qz.addQuestion")}</SubmitButton>
        {onDone && <button type="button" onClick={onDone} className="text-sm text-muted hover:text-fg">{t("qz.cancel")}</button>}
      </div>
    </KeepForm>
  );
}
