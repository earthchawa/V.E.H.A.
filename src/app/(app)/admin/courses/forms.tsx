"use client";

import { KeepForm } from "@/components/KeepForm";
import { useActionState } from "react";
import { createCourseAction, createOfferingAction, createTermAction, importScheduleAction } from "../actions";
import { FileDropzone } from "@/components/FileDropzone";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { useI18n } from "@/lib/i18n/client";

export function CreateTermForm() {
  const [state, action, pending] = useActionState(createTermAction, undefined);
  const { t } = useI18n();
  return (
    <KeepForm action={action} pending={pending} state={state} resetOnSuccess closeOnSuccess className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="academicYear">{t("tc.year")}</label>
          <input id="academicYear" name="academicYear" type="number" className="input" placeholder="2569" required />
        </div>
        <div>
          <label className="label" htmlFor="semester">{t("tc.semester")}</label>
          <select id="semester" name="semester" className="input">
            <option value="1">1</option><option value="2">2</option><option value="3">{t("tc.summer")}</option>
          </select>
        </div>
      </div>
      <FormMessage state={state} />
      <SubmitButton>{t("tc.addTerm")}</SubmitButton>
    </KeepForm>
  );
}

export function CreateCourseForm({ departments = [] }: { departments?: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState(createCourseAction, undefined);
  const { t } = useI18n();
  return (
    <KeepForm action={action} pending={pending} state={state} resetOnSuccess closeOnSuccess className="space-y-4">
      <div className="grid grid-cols-[1fr_5rem] gap-3">
        <div>
          <label className="label" htmlFor="code">{t("tc.code")}</label>
          <input id="code" name="code" className="input font-mono" placeholder="CS201" required />
        </div>
        <div>
          <label className="label" htmlFor="credits">{t("tc.credits")}</label>
          <input id="credits" name="credits" type="number" min={0} max={12} className="input" />
        </div>
      </div>
      {departments.length > 0 && (
        <div>
          <label className="label" htmlFor="c-dept">{t("dep.field")}</label>
          <select id="c-dept" name="departmentId" className="input" defaultValue="">
            <option value="">{t("dep.unassigned")}</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="label" htmlFor="title">{t("tc.courseTitle")}</label>
        <input id="title" name="title" className="input" required />
      </div>
      <div>
        <label className="label" htmlFor="titleTh">{t("tc.thaiTitle")} <span className="text-subtle">{t("common.optional")}</span></label>
        <input id="titleTh" name="titleTh" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="description">{t("tc.description")} <span className="text-subtle">{t("common.optional")}</span></label>
        <textarea id="description" name="description" rows={2} className="input" />
      </div>
      <FormMessage state={state} />
      <SubmitButton>{t("tc.addCourse")}</SubmitButton>
    </KeepForm>
  );
}

export function CreateOfferingForm({
  courses,
  terms,
}: {
  courses: { id: string; label: string }[];
  terms: { id: string; label: string; isCurrent: boolean }[];
}) {
  const [state, action, pending] = useActionState(createOfferingAction, undefined);
  const { t } = useI18n();
  return (
    <KeepForm action={action} pending={pending} state={state} resetOnSuccess closeOnSuccess className="space-y-4">
      <div>
        <label className="label" htmlFor="courseId">{t("tc.course")}</label>
        <select id="courseId" name="courseId" className="input" required>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-[1fr_5rem] gap-3">
        <div>
          <label className="label" htmlFor="termId">{t("tc.term")}</label>
          <select id="termId" name="termId" className="input" defaultValue={terms.find((x) => x.isCurrent)?.id} required>
            {terms.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="section">{t("tc.section")}</label>
          <input id="section" name="section" className="input" defaultValue="1" />
        </div>
      </div>
      <FormMessage state={state} />
      <SubmitButton>{t("tc.offer")}</SubmitButton>
    </KeepForm>
  );
}

/** Import a whole teaching schedule: terms, courses, sections and their instructors in one go. */
export function ImportScheduleForm() {
  const [state, action, pending] = useActionState(importScheduleAction, undefined);
  const { t } = useI18n();
  return (
    <KeepForm action={action} pending={pending} state={state} resetOnSuccess className="space-y-4">
      <p className="text-xs leading-relaxed text-muted">{t("sched.help")}</p>
      <pre className="overflow-x-auto rounded-lg bg-surface-2 p-3 font-mono text-[11px] leading-relaxed text-muted">{`year,semester,code,title_th,title_en,credits,section,instructors
2569,1,CS231,,,,1,nanthiphat_p
2569,2,คต 132,การโปรแกรมคอมพิวเตอร์เบื้องต้น,Introduction to Computer Programming,3,1,thewa_k siraphat_t`}</pre>
      <FileDropzone id="sched-file" name="file" accept=".csv,text/csv" />
      <textarea name="csv" rows={4} className="input font-mono text-xs" aria-label="CSV rows" placeholder={t("sched.paste")} />
      <FormMessage state={state} />
      <SubmitButton pendingText={t("users.importing")}>{t("sched.importBtn")}</SubmitButton>
    </KeepForm>
  );
}
