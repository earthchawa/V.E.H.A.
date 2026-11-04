"use client";

import { useActionState } from "react";
import { KeepForm } from "@/components/KeepForm";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { useI18n } from "@/lib/i18n/client";
import { saveQuizAction } from "./actions";

export type QuizDefaults = {
  title: string;
  instructions: string;
  opensAt: string;
  closesAt: string;
  timeLimitMin: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  isPublished: boolean;
  results: "HIDDEN" | "SCORE" | "FULL";
  requireSeb: boolean;
  sebConfigKeys: string;
  allowedIps: string;
  categoryId: string;
};

export const EMPTY_QUIZ: QuizDefaults = {
  title: "",
  instructions: "",
  opensAt: "",
  closesAt: "",
  timeLimitMin: "",
  shuffleQuestions: true,
  shuffleOptions: true,
  isPublished: false,
  results: "SCORE",
  requireSeb: false,
  sebConfigKeys: "",
  allowedIps: "",
  categoryId: "",
};

export function QuizForm({
  offeringId,
  quizId = null,
  defaults = EMPTY_QUIZ,
  categories = [],
  startUrl,
}: {
  offeringId: string;
  quizId?: string | null;
  defaults?: QuizDefaults;
  categories?: { id: string; name: string }[];
  startUrl?: string;
}) {
  const [state, action, pending] = useActionState(saveQuizAction.bind(null, offeringId, quizId), undefined);
  const { t } = useI18n();
  const d = defaults;
  const check = (name: keyof QuizDefaults, label: string) => (
    <label className="flex items-center gap-2">
      <input type="checkbox" name={name} defaultChecked={d[name] as boolean} className="accent-accent" /> {label}
    </label>
  );
  return (
    <KeepForm action={action} pending={pending} className="space-y-4">
      <div>
        <label className="label" htmlFor="qz-title">{t("qz.f.title")}</label>
        <input id="qz-title" name="title" className="input" defaultValue={d.title} required maxLength={200} />
      </div>
      <div>
        <label className="label" htmlFor="qz-instr">{t("qz.f.instructions")} <span className="text-subtle">{t("common.optional")}</span></label>
        <textarea id="qz-instr" name="instructions" rows={3} className="input" defaultValue={d.instructions} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="qz-open">{t("qz.f.opensAt")}</label>
          <input id="qz-open" name="opensAt" type="datetime-local" className="input" defaultValue={d.opensAt} />
        </div>
        <div>
          <label className="label" htmlFor="qz-close">{t("qz.f.closesAt")}</label>
          <input id="qz-close" name="closesAt" type="datetime-local" className="input" defaultValue={d.closesAt} />
        </div>
        <p className="-mt-1.5 text-xs text-subtle sm:col-span-2">{t("qz.f.windowHint")}</p>
      </div>
      <div className="grid grid-cols-[8rem_1fr] gap-3">
        <div>
          <label className="label" htmlFor="qz-limit">{t("qz.f.timeLimit")}</label>
          <input id="qz-limit" name="timeLimitMin" inputMode="numeric" className="input" defaultValue={d.timeLimitMin} />
        </div>
        <div>
          <label className="label" htmlFor="qz-cat">{t("asg.f.category")}</label>
          <select id="qz-cat" name="categoryId" className="input" defaultValue={d.categoryId}>
            <option value="">{t("gr.noCategory")}</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <p className="col-span-2 -mt-1.5 text-xs text-subtle">{t("qz.f.timeLimitHint")}</p>
      </div>
      <div className="space-y-2 text-sm text-muted">
        {check("shuffleQuestions", t("qz.f.shuffleQuestions"))}
        {check("shuffleOptions", t("qz.f.shuffleOptions"))}
        {quizId && check("isPublished", t("qz.f.published"))}
      </div>
      <div>
        <label className="label" htmlFor="qz-results">{t("qz.f.results")}</label>
        <select id="qz-results" name="results" className="input" defaultValue={d.results}>
          <option value="HIDDEN">{t("qz.res.HIDDEN")}</option>
          <option value="SCORE">{t("qz.res.SCORE")}</option>
          <option value="FULL">{t("qz.res.FULL")}</option>
        </select>
      </div>
      <fieldset className="space-y-3 rounded-lg border border-border p-3">
        <legend className="px-1 text-xs font-medium text-muted">{t("qz.f.security")}</legend>
        <div className="text-sm text-muted">{check("requireSeb", t("qz.f.requireSeb"))}</div>
        <div>
          <label className="label" htmlFor="qz-seb">{t("qz.f.sebKeys")}</label>
          <textarea id="qz-seb" name="sebConfigKeys" rows={2} className="input font-mono text-xs" defaultValue={d.sebConfigKeys} />
          <p className="mt-1.5 text-xs text-subtle">{t("qz.f.sebHint")}</p>
          {startUrl && (
            <p className="mt-1.5 text-xs text-subtle">
              {t("qz.f.startUrl")}: <code className="select-all font-mono text-fg">{startUrl}</code>
            </p>
          )}
        </div>
        <div>
          <label className="label" htmlFor="qz-ips">{t("qz.f.allowedIps")}</label>
          <textarea id="qz-ips" name="allowedIps" rows={2} className="input font-mono text-xs" defaultValue={d.allowedIps} placeholder="10.20.0.0/16" />
          <p className="mt-1.5 text-xs text-subtle">{t("qz.f.ipHint")}</p>
        </div>
      </fieldset>
      <FormMessage state={state} />
      <SubmitButton>{t(quizId ? "qz.f.save" : "qz.f.create")}</SubmitButton>
    </KeepForm>
  );
}
