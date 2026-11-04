"use client";

import { useActionState } from "react";
import { createCourseAction, createOfferingAction, createTermAction } from "../actions";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function CreateTermForm() {
  const [state, action] = useActionState(createTermAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="academicYear">Year (B.E.)</label>
          <input id="academicYear" name="academicYear" type="number" className="input" placeholder="2569" required />
        </div>
        <div>
          <label className="label" htmlFor="semester">Semester</label>
          <select id="semester" name="semester" className="input">
            <option value="1">1</option><option value="2">2</option><option value="3">Summer</option>
          </select>
        </div>
      </div>
      <FormMessage state={state} />
      <SubmitButton>Add term</SubmitButton>
    </form>
  );
}

export function CreateCourseForm() {
  const [state, action] = useActionState(createCourseAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-[1fr_5rem] gap-3">
        <div>
          <label className="label" htmlFor="code">Code</label>
          <input id="code" name="code" className="input font-mono" placeholder="CS201" required />
        </div>
        <div>
          <label className="label" htmlFor="credits">Credits</label>
          <input id="credits" name="credits" type="number" min={0} max={12} className="input" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="title">Title</label>
        <input id="title" name="title" className="input" required />
      </div>
      <div>
        <label className="label" htmlFor="titleTh">Thai title <span className="text-subtle">(optional)</span></label>
        <input id="titleTh" name="titleTh" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="description">Description <span className="text-subtle">(optional)</span></label>
        <textarea id="description" name="description" rows={2} className="input" />
      </div>
      <FormMessage state={state} />
      <SubmitButton>Add course</SubmitButton>
    </form>
  );
}

export function CreateOfferingForm({
  courses,
  terms,
}: {
  courses: { id: string; label: string }[];
  terms: { id: string; label: string; isCurrent: boolean }[];
}) {
  const [state, action] = useActionState(createOfferingAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="courseId">Course</label>
        <select id="courseId" name="courseId" className="input" required>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-[1fr_5rem] gap-3">
        <div>
          <label className="label" htmlFor="termId">Term</label>
          <select id="termId" name="termId" className="input" defaultValue={terms.find((t) => t.isCurrent)?.id} required>
            {terms.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="section">Section</label>
          <input id="section" name="section" className="input" defaultValue="1" />
        </div>
      </div>
      <FormMessage state={state} />
      <SubmitButton>Offer course</SubmitButton>
    </form>
  );
}
