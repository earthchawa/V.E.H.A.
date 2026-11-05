"use client";

import { setCourseDepartmentAction } from "../actions";

/** Change a course's department; submits as soon as a different one is picked. */
export function CourseDepartmentSelect({
  courseId,
  value,
  options,
  noneLabel,
  ariaLabel,
}: {
  courseId: string;
  value: string;
  options: { id: string; label: string }[];
  noneLabel: string;
  ariaLabel: string;
}) {
  return (
    <form action={setCourseDepartmentAction}>
      <input type="hidden" name="courseId" value={courseId} />
      <select
        name="departmentId"
        defaultValue={value}
        aria-label={ariaLabel}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="input h-8 w-full py-0 text-xs sm:w-auto sm:max-w-64"
      >
        <option value="">{noneLabel}</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </form>
  );
}
