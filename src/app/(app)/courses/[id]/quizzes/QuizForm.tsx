"use client";

import { useActionState, useState } from "react";
import { KeepForm } from "@/components/KeepForm";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { useI18n } from "@/lib/i18n/client";
import { saveQuizAction } from "./actions";
import { InfoTip } from "@/components/InfoTip";

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
  networkIds: string[];
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
  networkIds: [],
  categoryId: "",
};

export function QuizForm({
  offeringId,
  quizId = null,
  defaults = EMPTY_QUIZ,
  categories = [],
  networks = [],
  closeOnSuccess = false,
  sebEnabled = false,
}: {
  /** Offer the Safe Exam Browser mode (config.sebEnabled). */
  sebEnabled?: boolean;
  offeringId: string;
  quizId?: string | null;
  defaults?: QuizDefaults;
  categories?: { id: string; name: string }[];
  /** Exam rooms defined by the admin. */
  networks?: { id: string; name: string }[];
  closeOnSuccess?: boolean;
}) {
  const [state, action, pending] = useActionState(saveQuizAction.bind(null, offeringId, quizId), undefined);
  const { t } = useI18n();
  const d = defaults;
  const [roomsOnly, setRoomsOnly] = useState(d.networkIds.length > 0);
  const [seb, setSeb] = useState(d.requireSeb);
  const choice = (checked: boolean, onSelect: () => void, title: string, hint: string, name: string, value: string) => (
    <label
      className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition ${checked ? "border-accent/60 bg-accent/5" : "border-border hover:bg-surface-2"}`}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onSelect} className="mt-1 accent-accent" />
      <span>
        <span className="block text-sm font-medium text-fg">{title}</span>
        {hint && <span className="mt-0.5 block text-xs leading-relaxed text-muted">{hint}</span>}
      </span>
    </label>
  );
  const check = (name: keyof QuizDefaults, label: string) => (
    <label className="flex items-center gap-2">
      <input type="checkbox" name={name} defaultChecked={d[name] as boolean} role="switch" className="toggle" /> {label}
    </label>
  );
  return (
    <KeepForm action={action} pending={pending} state={state} closeOnSuccess={closeOnSuccess} className="space-y-4">
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
          <label className="label flex items-center gap-1.5" htmlFor="qz-open">{t("qz.f.opensAt")} <InfoTip text={t("qz.f.windowHint")} align="start" /></label>
          <input id="qz-open" name="opensAt" type="datetime-local" className="input" defaultValue={d.opensAt} />
        </div>
        <div>
          <label className="label" htmlFor="qz-close">{t("qz.f.closesAt")}</label>
          <input id="qz-close" name="closesAt" type="datetime-local" className="input" defaultValue={d.closesAt} />
        </div>
      </div>
      <div className="grid grid-cols-[8rem_1fr] gap-3">
        <div>
          <label className="label flex items-center gap-1.5" htmlFor="qz-limit">{t("qz.f.timeLimit")} <InfoTip text={t("qz.f.timeLimitHint")} align="start" /></label>
          <input id="qz-limit" name="timeLimitMin" inputMode="numeric" className="input" defaultValue={d.timeLimitMin} />
        </div>
        <div>
          <label className="label" htmlFor="qz-cat">{t("asg.f.category")}</label>
          <select id="qz-cat" name="categoryId" className="input" defaultValue={d.categoryId}>
            <option value="">{t("gr.noCategory")}</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
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
      {sebEnabled ? (
        <fieldset className="space-y-2">
          <legend className="label">{t("qz.f.mode")}</legend>
          {choice(!seb, () => setSeb(false), t("qz.mode.browser"), t("qz.mode.browserHint"), "requireSeb", "")}
          {choice(seb, () => setSeb(true), t("qz.mode.seb"), t("qz.mode.sebHint"), "requireSeb", "on")}
        </fieldset>
      ) : (
        <p className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-muted" data-testid="fullscreen-note">
          {t("qz.mode.fullscreenNote")}
        </p>
      )}
      <fieldset className="space-y-2">
        <legend className="label">{t("qz.f.where")}</legend>
        {choice(!roomsOnly, () => setRoomsOnly(false), t("qz.where.anywhere"), "", "where", "anywhere")}
        {networks.length > 0 ? (
          <>
            {choice(roomsOnly, () => setRoomsOnly(true), t("qz.where.rooms"), t("qz.where.hint"), "where", "rooms")}
            {roomsOnly && (
              <div className="ml-7 space-y-1.5">
                {networks.map((n) => (
                  <label key={n.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="networkId" value={n.id} defaultChecked={d.networkIds.includes(n.id)} className="accent-accent" />
                    {n.name}
                  </label>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-subtle">{t("qz.where.none")}</p>
        )}
      </fieldset>
      <FormMessage state={state} />
      <SubmitButton>{t(quizId ? "qz.f.save" : "qz.f.create")}</SubmitButton>
    </KeepForm>
  );
}
