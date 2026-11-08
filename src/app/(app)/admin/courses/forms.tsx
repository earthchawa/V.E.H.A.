"use client";

import { KeepForm } from "@/components/KeepForm";
import { useActionState } from "react";
import { createCourseAction, createOfferingAction, createTermAction, importScheduleAction, updateCourseAction } from "../actions";
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

export type CourseDefaults = { id: string; code: string; title: string; titleTh: string | null; credits: number | null; description: string | null; departmentId: string | null };

/** Add a course to the catalogue, or edit one (pass `course`). */
export function CreateCourseForm({ departments = [], course }: { departments?: { id: string; label: string }[]; course?: CourseDefaults }) {
  const [state, action, pending] = useActionState(course ? updateCourseAction.bind(null, course.id) : createCourseAction, undefined);
  const { t } = useI18n();
  const id = (f: string) => (course ? `${f}-${course.id}` : f);
  return (
    <KeepForm action={action} pending={pending} state={state} resetOnSuccess={!course} closeOnSuccess className="space-y-4">
      <div className="grid grid-cols-[1fr_5rem] gap-3">
        <div>
          <label className="label" htmlFor={id("code")}>{t("tc.code")}</label>
          <input id={id("code")} name="code" className="input font-mono" placeholder="CS201" defaultValue={course?.code} required />
        </div>
        <div>
          <label className="label" htmlFor={id("credits")}>{t("tc.credits")}</label>
          <input id={id("credits")} name="credits" type="number" min={0} max={12} className="input" defaultValue={course?.credits ?? ""} />
        </div>
      </div>
      {departments.length > 0 && (
        <div>
          <label className="label" htmlFor={id("c-dept")}>{t("dep.field")}</label>
          <select id={id("c-dept")} name="departmentId" className="input" defaultValue={course?.departmentId ?? ""}>
            <option value="">{t("dep.unassigned")}</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="label" htmlFor={id("title")}>{t("tc.courseTitle")}</label>
        <input id={id("title")} name="title" className="input" defaultValue={course?.title} required />
      </div>
      <div>
        <label className="label" htmlFor={id("titleTh")}>{t("tc.thaiTitle")} <span className="text-subtle">{t("common.optional")}</span></label>
        <input id={id("titleTh")} name="titleTh" className="input" defaultValue={course?.titleTh ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor={id("description")}>{t("tc.description")} <span className="text-subtle">{t("common.optional")}</span></label>
        <textarea id={id("description")} name="description" rows={2} className="input" defaultValue={course?.description ?? ""} />
      </div>
      <FormMessage state={state} />
      <SubmitButton>{t(course ? "users.saveChanges" : "tc.addCourse")}</SubmitButton>
    </KeepForm>
  );
}

export function CreateOfferingForm({
  courses,
  terms,
  defaultTermId,
}: {
  courses: { id: string; label: string }[];
  terms: { id: string; label: string; isCurrent: boolean }[];
  /** Semester picked on the page; falls back to the current one. */
  defaultTermId?: string;
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
          <select id="termId" name="termId" className="input" defaultValue={defaultTermId ?? terms.find((x) => x.isCurrent)?.id} required>
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
      <pre className="overflow-x-auto rounded-lg bg-surface-2 p-3 font-mono text-[11px] leading-relaxed text-muted">{`year,semester,code,title_th,title_en,credits,section,instructors,cadets
2569,1,CS231,,,,1,nanthiphat_p,phasawat_p khanison_n
2569,2,คต 132,การโปรแกรมคอมพิวเตอร์เบื้องต้น,Introduction to Computer Programming,3,1,thewa_k siraphat_t`}</pre>
      <FileDropzone id="sched-file" name="file" accept=".csv,text/csv" />
      <textarea name="csv" rows={4} className="input font-mono text-xs" aria-label="CSV rows" placeholder={t("sched.paste")} />
      <FormMessage state={state} />
      <SubmitButton pendingText={t("users.importing")}>{t("sched.importBtn")}</SubmitButton>
    </KeepForm>
  );
}
