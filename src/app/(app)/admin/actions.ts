"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/lib/form";
import { requireRole } from "@/lib/auth/session";
import { issueTempPassword } from "@/lib/auth/account";
import { generateTempPassword, hashPassword, tempPasswordExpiry } from "@/lib/auth/password";
import { parseUserImport, type UserImportRow } from "@/lib/csv";
import { AREA_DEPARTMENT, codeArea, parseSchedule } from "@/lib/schedule-import";
import { config } from "@/lib/config";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getI18n } from "@/lib/i18n/server";
import { SETTING, setSetting } from "@/lib/settings";
import { BUNDLED_LOGOS, isHexColor } from "@/lib/departments";
import { deleteStoredFile, saveFile } from "@/lib/storage";
import { DEFAULT_FINAL_YEAR, MAX_YEAR_LEVEL, parseYearLevel, planPromotion } from "@/lib/year-level";
import { currentAcademicYear, setYearLevel } from "@/lib/year-level-server";
import { redirect } from "next/navigation";

const LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
import type { Translator } from "@/lib/i18n";

export type IssuedPassword = { username: string; fullName: string; password: string };

const admin = () => requireRole("ADMIN");

// ---------- Users ----------

async function createUsers(actorId: string, rows: UserImportRow[], t: Translator["t"]) {
  const existing = new Map(
    (await db.user.findMany({ where: { username: { in: rows.map((r) => r.username) } }, select: { username: true, id: true, role: true } }))
      .map((u) => [u.username, u]),
  );
  const academicYear = rows.some((r) => r.yearLevel != null) ? await currentAcademicYear() : 0;
  const emails = rows.map((r) => r.email).filter((e): e is string => !!e);
  const takenEmails = new Set(
    (await db.user.findMany({ where: { email: { in: emails } }, select: { email: true } })).map((u) => u.email),
  );

  const depts = new Map(
    (await db.department.findMany({ select: { id: true, code: true } })).map((d) => [d.code, d.id]),
  );
  const issued: IssuedPassword[] = [];
  const skipped: string[] = [];
  /** Existing cadets whose year level was set from the file (the account itself is never changed). */
  const yearSet: string[] = [];
  for (const r of rows) {
    if (r.department && !depts.has(r.department)) { skipped.push(t("users.skip.dept", { id: r.username, code: r.department })); continue; }
    const found = existing.get(r.username);
    if (found) {
      // A re-import with a year column fills in year levels for accounts that already exist.
      if (r.yearLevel != null && found.role === "STUDENT") {
        if ((await setYearLevel(found.id, academicYear, r.yearLevel)) !== r.yearLevel) yearSet.push(r.username);
      } else skipped.push(t("users.skip.exists", { id: r.username }));
      continue;
    }
    if (r.email && takenEmails.has(r.email)) { skipped.push(t("users.skip.email", { id: r.username })); continue; }
    const password = r.password ?? generateTempPassword();
    const created = await db.user.create({
      data: {
        username: r.username,
        fullName: r.fullName,
        role: r.role,
        email: r.email,
        departmentId: r.department ? depts.get(r.department) : null,
        passwordHash: await hashPassword(password),
        mustChangePassword: true,
        tempPasswordExpiresAt: tempPasswordExpiry(config.tempPasswordDays),
      },
    });
    if (r.yearLevel != null) await db.cadetYear.create({ data: { userId: created.id, academicYear, yearLevel: r.yearLevel } });
    issued.push({ username: r.username, fullName: r.fullName, password });
  }
  if (yearSet.length)
    await audit({ actorId, action: "user.yearSet", details: { academicYear, usernames: yearSet } });
  if (issued.length)
    await audit({ actorId, action: "user.created", details: { usernames: issued.map((i) => i.username) } });
  return { issued, skipped, yearSet, academicYear };
}

export async function createUserAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await admin();
  const { t, tm } = await getI18n();
  const line = [fd.get("username"), fd.get("fullName"), fd.get("role"), fd.get("email"), fd.get("department"), "", fd.get("role") === "STUDENT" ? fd.get("yearLevel") : ""]
    .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
    .join(",");
  const { rows, errors } = parseUserImport(line);
  if (errors.length) return { error: tm(errors[0]).replace(/^[^:]+1: /, "") };
  const { issued, skipped } = await createUsers(me.id, rows, t);
  revalidatePath("/admin/users");
  if (skipped.length) return { error: t("err.notCreated", { list: skipped.join(", ") }) };
  return { success: t("ok.accountCreated"), data: issued };
}

export async function importUsersAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await admin();
  const { t, tn, tm } = await getI18n();
  const file = fd.get("file");
  const text = file instanceof File && file.size > 0 ? await file.text() : String(fd.get("csv") ?? "");
  if (!text.trim()) return { error: t("err.csvMissing") };
  const { rows, errors } = parseUserImport(text);
  if (errors.length) return { error: t("err.csvRows", { rows: errors.slice(0, 10).map(tm).join("\n") }) };
  const { issued, skipped, yearSet, academicYear } = await createUsers(me.id, rows, t);
  revalidatePath("/admin/users");
  return {
    success:
      tn("ok.imported", issued.length) +
      (yearSet.length ? t("ok.importYearSet", { n: yearSet.length, year: academicYear }) : "") +
      (skipped.length ? t("ok.importSkipped", { n: skipped.length, list: skipped.join(", ") }) : ""),
    data: issued,
  };
}

export async function resetUserPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await admin();
  const { t } = await getI18n();
  const user = await db.user.findUniqueOrThrow({ where: { id: String(fd.get("userId")) } });
  const password = await issueTempPassword(me.id, user.id);
  revalidatePath("/admin/users");
  return {
    success: t("ok.tempIssued", { id: user.username }),
    data: [{ username: user.username, fullName: user.fullName, password }] satisfies IssuedPassword[],
  };
}

export async function toggleUserActiveAction(fd: FormData): Promise<void> {
  const me = await admin();
  const id = String(fd.get("userId"));
  if (id === me.id) return; // never lock yourself out
  const user = await db.user.findUniqueOrThrow({ where: { id } });
  await db.user.update({ where: { id }, data: { isActive: !user.isActive } });
  if (user.isActive) await db.session.deleteMany({ where: { userId: id } });
  await audit({ actorId: me.id, action: user.isActive ? "user.deactivated" : "user.activated", targetType: "User", targetId: id });
  revalidatePath("/admin/users");
}

/**
 * Edit an account: username (cadet number or staff login), full name with rank or academic title,
 * role, email and department. Changes are audited with their old and new values.
 */
export async function updateUserAction(userId: string, _: FormState, fd: FormData): Promise<FormState> {
  const me = await admin();
  const { t } = await getI18n();
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { department: { select: { code: true } } } });

  const username = String(fd.get("username") ?? "").trim();
  const fullName = String(fd.get("fullName") ?? "").trim().replace(/\s+/g, " ").slice(0, 200);
  const roleRaw = String(fd.get("role") ?? user.role);
  const email = String(fd.get("email") ?? "").trim().toLowerCase() || null;
  const deptCode = String(fd.get("department") ?? "").trim().toUpperCase() || null;

  if (!/^[A-Za-z0-9._-]{3,32}$/.test(username)) return { error: t("users.err.username") };
  if (!fullName) return { error: t("users.err.name") };
  if (!["ADMIN", "INSTRUCTOR", "STUDENT"].includes(roleRaw)) return { error: t("common.invalid") };
  const role = roleRaw as "ADMIN" | "INSTRUCTOR" | "STUDENT";
  if (user.id === me.id && role !== "ADMIN") return { error: t("users.err.selfRole") }; // never lock yourself out
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: t("users.err.email") };
  if (username !== user.username && (await db.user.findUnique({ where: { username } }))) return { error: t("users.err.taken", { id: username }) };
  if (email && email !== user.email && (await db.user.findUnique({ where: { email } }))) return { error: t("users.err.emailTaken") };
  const dept = deptCode ? await db.department.findUnique({ where: { code: deptCode } }) : null;
  if (deptCode && !dept) return { error: t("common.invalid") };
  // Year level (cadets only), for the academic year shown in the form.
  const yearRaw = String(fd.get("yearLevel") ?? "").trim();
  const academicYear = Number(fd.get("academicYear")) || (await currentAcademicYear());
  const yearLevel = role === "STUDENT" ? parseYearLevel(yearRaw) : null;
  if (role === "STUDENT" && yearRaw && yearLevel == null) return { error: t("common.invalid") };
  const yearBefore = (await db.cadetYear.findUnique({ where: { userId_academicYear: { userId: user.id, academicYear } } }))?.yearLevel ?? null;

  const before = { username: user.username, fullName: user.fullName, role: user.role, email: user.email, department: user.department?.code ?? null, yearLevel: yearBefore };
  const after = { username, fullName, role, email, department: dept?.code ?? null, yearLevel: fd.has("yearLevel") || role !== "STUDENT" ? yearLevel : yearBefore };
  const changed = Object.fromEntries(
    Object.keys(after)
      .filter((k) => before[k as keyof typeof before] !== after[k as keyof typeof after])
      .map((k) => [k, { from: before[k as keyof typeof before], to: after[k as keyof typeof after] }]),
  );
  if (!Object.keys(changed).length) return { success: t("ok.saved") };

  await db.user.update({ where: { id: user.id }, data: { username, fullName, role, email, departmentId: dept?.id ?? null } });
  if (changed.yearLevel) await setYearLevel(user.id, academicYear, after.yearLevel);
  // Sign them out after a role change so menus and permissions match at once (admins can't change their own role).
  if (changed.role) await db.session.deleteMany({ where: { userId: user.id } });
  await audit({ actorId: me.id, action: "user.updated", targetType: "User", targetId: user.id, details: changed.yearLevel ? { ...changed, academicYear } : changed });
  revalidatePath("/admin/users");
  return { success: t("ok.saved") };
}

/**
 * End of the academic year: every cadet with a year level in `from` gets a row for the next year, one level up.
 * The final year graduates (no new row; optionally the accounts are disabled). Rows of earlier years stay as
 * the history, and cadets who already have a row in the next year are left alone, so it is safe to run twice.
 */
export async function promoteCadetsAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await admin();
  const { t } = await getI18n();
  const from = Number(fd.get("from"));
  const finalYear = Number(fd.get("finalYear") ?? DEFAULT_FINAL_YEAR);
  if (!Number.isInteger(from) || from < 2500 || from > 2700) return { error: t("common.invalid") };
  if (!Number.isInteger(finalYear) || finalYear < 1 || finalYear > MAX_YEAR_LEVEL) return { error: t("common.invalid") };
  const to = from + 1;
  const [current, next] = await Promise.all([
    db.cadetYear.findMany({ where: { academicYear: from, user: { role: "STUDENT", isActive: true } }, select: { userId: true, yearLevel: true } }),
    db.cadetYear.findMany({ where: { academicYear: to }, select: { userId: true } }),
  ]);
  if (!current.length) return { error: t("promo.err.none", { year: from }) };
  const plan = planPromotion(current, next.map((r) => r.userId), finalYear);
  const disable = fd.get("disableGraduates") === "on" && plan.graduate.length > 0;
  await db.$transaction([
    db.cadetYear.createMany({ data: plan.promote.map((r) => ({ ...r, academicYear: to })), skipDuplicates: true }),
    ...(disable
      ? [
          db.user.updateMany({ where: { id: { in: plan.graduate } }, data: { isActive: false } }),
          db.session.deleteMany({ where: { userId: { in: plan.graduate } } }),
        ]
      : []),
  ]);
  await audit({
    actorId: me.id,
    action: "user.promoted",
    details: { from, to, finalYear, promoted: plan.promote.length, graduated: plan.graduate.length, disabledGraduates: disable, alreadyDone: plan.skipped },
  });
  revalidatePath("/admin/users");
  return { success: t("promo.ok", { to, promoted: plan.promote.length, graduated: plan.graduate.length, skipped: plan.skipped }) };
}

// ---------- Terms / courses / offerings ----------

const termSchema = z.object({
  academicYear: z.coerce.number().int().min(2500).max(2700),
  semester: z.coerce.number().int().min(1).max(3),
});

export async function createTermAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await admin();
  const { t } = await getI18n();
  const parsed = termSchema.safeParse({ academicYear: fd.get("academicYear"), semester: fd.get("semester") });
  if (!parsed.success) return { error: t("err.termInvalid") };
  const exists = await db.term.findUnique({ where: { academicYear_semester: parsed.data } });
  if (exists) return { error: t("err.termExists") };
  const hasCurrent = await db.term.count({ where: { isCurrent: true } });
  const term = await db.term.create({ data: { ...parsed.data, isCurrent: hasCurrent === 0 } });
  await audit({ actorId: me.id, action: "term.created", targetType: "Term", targetId: term.id });
  revalidatePath("/admin/courses");
  return { success: t("ok.termAdded") };
}

export async function setCurrentTermAction(fd: FormData): Promise<void> {
  const me = await admin();
  const id = String(fd.get("termId"));
  await db.$transaction([
    db.term.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } }),
    db.term.update({ where: { id }, data: { isCurrent: true } }),
  ]);
  await audit({ actorId: me.id, action: "term.set_current", targetType: "Term", targetId: id });
  revalidatePath("/", "layout");
}

const courseSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,16}$/),
  title: z.string().trim().min(1).max(200),
  titleTh: z.string().trim().max(200).optional(),
  credits: z.coerce.number().int().min(0).max(12).optional(),
  description: z.string().trim().max(4000).optional(),
  departmentId: z.string().optional(),
});

export async function createCourseAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await admin();
  const { t } = await getI18n();
  const parsed = courseSchema.safeParse({
    code: fd.get("code"),
    title: fd.get("title"),
    titleTh: fd.get("titleTh") || undefined,
    credits: fd.get("credits") || undefined,
    description: fd.get("description") || undefined,
    departmentId: fd.get("departmentId") || undefined,
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { error: t(field === "code" ? "err.courseCode" : field === "title" ? "err.courseTitle" : "common.invalid") };
  }
  if (await db.course.findUnique({ where: { code: parsed.data.code } })) return { error: t("err.courseExists") };
  const dept = parsed.data.departmentId ? await db.department.findUnique({ where: { id: parsed.data.departmentId } }) : null;
  const course = await db.course.create({ data: { ...parsed.data, departmentId: dept?.id ?? null } });
  await audit({ actorId: me.id, action: "course.created", targetType: "Course", targetId: course.id });
  revalidatePath("/admin/courses");
  return { success: t("ok.courseAdded", { code: course.code }) };
}

/** Edit a catalogue course (code, titles, credits, description, subject area). Audited with old → new values. */
export async function updateCourseAction(courseId: string, _: FormState, fd: FormData): Promise<FormState> {
  const me = await admin();
  const { t } = await getI18n();
  const course = await db.course.findUniqueOrThrow({ where: { id: courseId } });
  const parsed = courseSchema.safeParse({
    code: fd.get("code"),
    title: fd.get("title"),
    titleTh: fd.get("titleTh") || undefined,
    credits: fd.get("credits") || undefined,
    description: fd.get("description") || undefined,
    departmentId: fd.get("departmentId") || undefined,
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { error: t(field === "code" ? "err.courseCode" : field === "title" ? "err.courseTitle" : "common.invalid") };
  }
  const d = parsed.data;
  if (d.code !== course.code && (await db.course.findUnique({ where: { code: d.code } }))) return { error: t("err.courseExists") };
  const dept = d.departmentId ? await db.department.findUnique({ where: { id: d.departmentId } }) : null;
  const next = { code: d.code, title: d.title, titleTh: d.titleTh ?? null, credits: d.credits ?? null, description: d.description ?? null, departmentId: dept?.id ?? null };
  const changed = Object.fromEntries(
    (Object.keys(next) as (keyof typeof next)[])
      .filter((k) => (course[k] ?? null) !== next[k])
      .map((k) => [k, { from: course[k] ?? null, to: next[k] }]),
  );
  if (!Object.keys(changed).length) return { success: t("ok.saved") };
  await db.course.update({ where: { id: course.id }, data: next });
  await audit({ actorId: me.id, action: "course.updated", targetType: "Course", targetId: course.id, details: changed });
  revalidatePath("/admin/courses");
  return { success: t("ok.saved") };
}

export async function createOfferingAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await admin();
  const { t } = await getI18n();
  const courseId = String(fd.get("courseId") ?? "");
  const termId = String(fd.get("termId") ?? "");
  const section = String(fd.get("section") ?? "").trim() || "1";
  if (!courseId || !termId) return { error: t("err.chooseCourseTerm") };
  if (!/^[A-Za-z0-9-]{1,8}$/.test(section)) return { error: t("err.section") };
  const exists = await db.courseOffering.findUnique({ where: { courseId_termId_section: { courseId, termId, section } } });
  if (exists) return { error: t("err.offeringExists") };
  const o = await db.courseOffering.create({ data: { courseId, termId, section } });
  await audit({ actorId: me.id, action: "offering.created", targetType: "CourseOffering", targetId: o.id });
  revalidatePath("/admin/courses");
  return { success: t("ok.offered") };
}

/**
 * Import a teaching schedule (CSV): creates missing terms, courses and sections and enrols the instructors.
 * Safe to run again: nothing that already exists is changed, so a corrected file can be re-imported.
 */
export async function importScheduleAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await admin();
  const { t, tm } = await getI18n();
  const file = fd.get("file");
  const text = file instanceof File && file.size > 0 ? await file.text() : String(fd.get("csv") ?? "");
  if (!text.trim()) return { error: t("err.csvMissing") };
  const { rows, errors } = parseSchedule(text);
  if (errors.length) return { error: t("err.csvRows", { rows: errors.slice(0, 10).map(tm).join("\n") }) };

  // Every instructor and cadet must already have an account (import them first on the Users page).
  const usernames = [...new Set(rows.flatMap((r) => [...r.instructors, ...r.cadets]))];
  const users = await db.user.findMany({ where: { username: { in: usernames } }, select: { id: true, username: true, role: true } });
  const byName = new Map(users.map((u) => [u.username, u]));
  const missing = usernames.filter((u) => !byName.has(u));
  if (missing.length) return { error: t("sched.err.missingUsers", { list: missing.join(", ") }) };
  const asInstructor = new Set(rows.flatMap((r) => r.instructors));
  const asCadet = new Set(rows.flatMap((r) => r.cadets));
  const cadetsAsInstructors = users.filter((u) => u.role === "STUDENT" && asInstructor.has(u.username)).map((u) => u.username);
  if (cadetsAsInstructors.length) return { error: t("roster.cadetNotInstructor", { list: cadetsAsInstructors.join(", ") }) };
  const staffAsCadets = users.filter((u) => u.role !== "STUDENT" && asCadet.has(u.username)).map((u) => u.username);
  if (staffAsCadets.length) return { error: t("sched.err.notCadet", { list: staffAsCadets.join(", ") }) };

  const depts = new Map((await db.department.findMany({ select: { id: true, code: true } })).map((d) => [d.code, d.id]));
  const count = { terms: 0, courses: 0, offerings: 0, enrolled: 0, cadets: 0 };
  for (const r of rows) {
    let term = await db.term.findUnique({ where: { academicYear_semester: { academicYear: r.academicYear, semester: r.semester } } });
    if (!term) {
      term = await db.term.create({ data: { academicYear: r.academicYear, semester: r.semester } });
      count.terms++;
    }
    let course = await db.course.findUnique({ where: { code: r.code } });
    if (!course) {
      course = await db.course.create({
        data: {
          code: r.code,
          title: r.titleEn ?? r.titleTh ?? r.code,
          titleTh: r.titleTh,
          credits: r.credits,
          departmentId: depts.get(codeArea(r.code)) ?? depts.get(AREA_DEPARTMENT[codeArea(r.code)] ?? "") ?? null,
        },
      });
      count.courses++;
    }
    let offering = await db.courseOffering.findUnique({ where: { courseId_termId_section: { courseId: course.id, termId: term.id, section: r.section } } });
    if (!offering) {
      offering = await db.courseOffering.create({ data: { courseId: course.id, termId: term.id, section: r.section } });
      count.offerings++;
    }
    for (const name of r.instructors) {
      const userId = byName.get(name)!.id;
      const existing = await db.enrollment.findUnique({ where: { userId_offeringId: { userId, offeringId: offering.id } } });
      if (existing) continue;
      await db.enrollment.create({ data: { userId, offeringId: offering.id, role: "INSTRUCTOR" } });
      count.enrolled++;
    }
    for (const name of r.cadets) {
      const userId = byName.get(name)!.id;
      const existing = await db.enrollment.findUnique({ where: { userId_offeringId: { userId, offeringId: offering.id } } });
      if (existing) continue;
      await db.enrollment.create({ data: { userId, offeringId: offering.id, role: "STUDENT" } });
      count.cadets++;
    }
  }
  await audit({ actorId: me.id, action: "offering.imported", details: { rows: rows.length, ...count } });
  revalidatePath("/admin/courses");
  return { success: t("sched.ok", { rows: rows.length, ...count }) };
}

// ---------- Enrollment ----------

export async function enrollAction(offeringId: string, _: FormState, fd: FormData): Promise<FormState> {
  const me = await admin();
  const { t } = await getI18n();
  const role = fd.get("role") === "INSTRUCTOR" ? "INSTRUCTOR" : "STUDENT";
  const usernames = [...new Set(String(fd.get("usernames") ?? "").split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean))];
  if (!usernames.length) return { error: t("err.noIds") };

  const users = await db.user.findMany({ where: { username: { in: usernames } } });
  const found = new Set(users.map((u) => u.username));
  const missing = usernames.filter((u) => !found.has(u));
  const wrongRole = role === "INSTRUCTOR" ? users.filter((u) => u.role === "STUDENT").map((u) => u.username) : [];

  const toEnroll = users.filter((u) => !wrongRole.includes(u.username));
  for (const u of toEnroll) {
    await db.enrollment.upsert({
      where: { userId_offeringId: { userId: u.id, offeringId } },
      create: { userId: u.id, offeringId, role },
      update: { role },
    });
  }
  await audit({
    actorId: me.id,
    action: "enrollment.added",
    targetType: "CourseOffering",
    targetId: offeringId,
    details: { role, usernames: toEnroll.map((u) => u.username) },
  });
  revalidatePath(`/admin/offerings/${offeringId}`);
  const notes = [
    missing.length ? t("roster.notFound", { list: missing.join(", ") }) : "",
    wrongRole.length ? t("roster.cadetNotInstructor", { list: wrongRole.join(", ") }) : "",
  ].filter(Boolean);
  return notes.length
    ? { error: t("roster.addedWithNotes", { n: toEnroll.length, notes: notes.join(" · ") }) }
    : { success: t("ok.added", { n: toEnroll.length }) };
}

/**
 * Delete a course section with everything in it (materials, assignments and submissions, quizzes, grades).
 * The admin must type the course code to confirm. The course in the catalogue and the semester stay.
 */
export async function deleteOfferingAction(offeringId: string, _: FormState, fd: FormData): Promise<FormState> {
  const me = await admin();
  const { t } = await getI18n();
  const o = await db.courseOffering.findUnique({
    where: { id: offeringId },
    include: {
      course: { select: { code: true } },
      term: { select: { academicYear: true, semester: true } },
      materials: { select: { storageKey: true } },
      assignments: { select: { submissions: { select: { files: { select: { storageKey: true } } } } } },
      _count: { select: { enrollments: true, materials: true, assignments: true, quizzes: true, gradeItems: true } },
    },
  });
  if (!o) return { error: t("common.invalid") };
  const typed = String(fd.get("confirm") ?? "").replace(/\s+/g, "").toUpperCase();
  if (typed !== o.course.code.toUpperCase()) return { error: t("off.del.mismatch", { code: o.course.code }) };

  const keys = [
    ...o.materials.map((m) => m.storageKey),
    ...o.assignments.flatMap((a) => a.submissions.flatMap((s) => s.files.map((f) => f.storageKey))),
  ].filter((k): k is string => !!k);
  // Log first: the entry's department is resolved from the section, which is about to go.
  await audit({
    actorId: me.id,
    action: "offering.deleted",
    targetType: "CourseOffering",
    targetId: o.id,
    details: { course: o.course.code, term: `${o.term.semester}/${o.term.academicYear}`, section: o.section, ...o._count },
  });
  await db.courseOffering.delete({ where: { id: o.id } });
  for (const k of keys) await deleteStoredFile(k).catch(() => undefined);
  revalidatePath("/admin/courses");
  redirect(`/admin/courses?s=${o.termId}`);
}

export async function unenrollAction(fd: FormData): Promise<void> {
  const me = await admin();
  const enrollment = await db.enrollment.delete({ where: { id: String(fd.get("enrollmentId")) } });
  await audit({
    actorId: me.id,
    action: "enrollment.removed",
    targetType: "CourseOffering",
    targetId: enrollment.offeringId,
    details: { userId: enrollment.userId },
  });
  revalidatePath(`/admin/offerings/${enrollment.offeringId}`);
}

// ---------- Departments ----------

const DEPT_CODE = /^[A-Z0-9-]{1,16}$/;

/** Create (id = null) or update a division / department. */
export async function saveDepartmentAction(departmentId: string | null, _: FormState, fd: FormData): Promise<FormState> {
  const me = await admin();
  const { t } = await getI18n();
  const code = String(fd.get("code") ?? "").trim().toUpperCase();
  const name = String(fd.get("name") ?? "").trim().slice(0, 200);
  const nameTh = String(fd.get("nameTh") ?? "").trim().slice(0, 200) || null;
  const parentRaw = String(fd.get("parentId") ?? "");
  if (!DEPT_CODE.test(code)) return { error: t("dep.codeInvalid") };
  if (!name) return { error: t("err.nameRequired") };
  // Only two levels: a parent must itself be a division.
  const parent = parentRaw ? await db.department.findUnique({ where: { id: parentRaw } }) : null;
  const parentId = parent && !parent.parentId && parent.id !== departmentId ? parent.id : null;
  const clash = await db.department.findUnique({ where: { code } });
  if (clash && clash.id !== departmentId) return { error: t("dep.codeExists") };

  // Colour: departments may inherit their division's colour.
  const colorRaw = String(fd.get("color") ?? "");
  const color = fd.get("inheritColor") === "on" && parentId ? null : isHexColor(colorRaw) ? colorRaw.toLowerCase() : null;

  // Logo: "" = none/inherit, a bundled path, "upload" (new file) or "keep" (current upload).
  const logoChoice = String(fd.get("logo") ?? "");
  const existing = departmentId ? await db.department.findUnique({ where: { id: departmentId } }) : null;
  let logo: { logoUrl: string | null; logoKey: string | null; logoMime: string | null } = { logoUrl: null, logoKey: null, logoMime: null };
  if (logoChoice === "keep" && existing?.logoKey) {
    logo = { logoUrl: null, logoKey: existing.logoKey, logoMime: existing.logoMime };
  } else if (logoChoice === "upload") {
    const file = fd.get("logoFile");
    if (!(file instanceof File) || file.size === 0 || file.size > 1024 * 1024 || !LOGO_TYPES.has(file.type))
      return { error: t("dep.logoInvalid") };
    logo = { logoUrl: null, logoKey: await saveFile(file), logoMime: file.type };
  } else if (BUNDLED_LOGOS.some((l) => l.url === logoChoice)) {
    logo = { logoUrl: logoChoice, logoKey: null, logoMime: null };
  }

  if (departmentId) {
    const hasChildren = await db.department.count({ where: { parentId: departmentId } });
    await db.department.update({
      where: { id: departmentId },
      data: { code, name, nameTh, parentId: hasChildren ? null : parentId, color, ...logo },
    });
    // Replace: drop the previous uploaded file once it's no longer used.
    if (existing?.logoKey && existing.logoKey !== logo.logoKey) await deleteStoredFile(existing.logoKey);
  } else {
    const position = await db.department.count({ where: { parentId } });
    await db.department.create({ data: { code, name, nameTh, parentId, position, color, ...logo } });
  }
  await audit({ actorId: me.id, action: departmentId ? "department.updated" : "department.created", details: { code, name } });
  revalidatePath("/", "layout");
  return { success: t("ok.saved") };
}

export async function deleteDepartmentAction(fd: FormData): Promise<void> {
  const me = await admin();
  const id = String(fd.get("departmentId"));
  if (await db.department.count({ where: { parentId: id } })) return; // UI explains; children must go first
  const d = await db.department.delete({ where: { id } });
  await audit({ actorId: me.id, action: "department.deleted", details: { code: d.code } });
  revalidatePath("/", "layout");
}

export async function setCourseDepartmentAction(fd: FormData): Promise<void> {
  const me = await admin();
  const courseId = String(fd.get("courseId"));
  const raw = String(fd.get("departmentId") ?? "");
  const dept = raw ? await db.department.findUnique({ where: { id: raw } }) : null;
  await db.course.update({ where: { id: courseId }, data: { departmentId: dept?.id ?? null } });
  await audit({ actorId: me.id, action: "course.department_set", targetType: "Course", targetId: courseId, details: { department: dept?.code ?? null } });
  revalidatePath("/", "layout");
}

// ---------- Exam settings ----------

const CIDR = /^(\d{1,3}\.){3}\d{1,3}(\/(\d|[12]\d|3[0-2]))?$|^[0-9a-f:]+$/i;

export async function addExamNetworkAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await admin();
  const { t } = await getI18n();
  const name = String(fd.get("name") ?? "").trim().slice(0, 100);
  const lines = String(fd.get("cidrs") ?? "").split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  if (!name) return { error: t("err.nameRequired") };
  const bad = lines.find((l) => !CIDR.test(l) || l.split("/")[0].split(".").some((p) => Number(p) > 255));
  if (!lines.length || bad) return { error: t("es.invalidCidr", { v: bad ?? "—" }) };
  const n = await db.examNetwork.create({ data: { name, cidrs: lines.join("\n") } });
  await audit({ actorId: me.id, action: "exam.network_added", targetType: "ExamNetwork", targetId: n.id, details: { name, cidrs: lines } });
  revalidatePath("/admin/exam-settings");
  return { success: t("ok.saved") };
}

export async function deleteExamNetworkAction(fd: FormData): Promise<void> {
  const me = await admin();
  const n = await db.examNetwork.delete({ where: { id: String(fd.get("networkId")) } });
  await audit({ actorId: me.id, action: "exam.network_deleted", details: { name: n.name } });
  revalidatePath("/admin/exam-settings");
}

export async function saveSebKeysAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await admin();
  const { t } = await getI18n();
  const keys = String(fd.get("keys") ?? "").split(/\s+/).map((k) => k.trim()).filter(Boolean);
  if (keys.some((k) => !/^[0-9a-f]{64}$/i.test(k))) return { error: t("common.invalid") };
  await setSetting(SETTING.sebConfigKeys, keys.join("\n"));
  await audit({ actorId: me.id, action: "exam.seb_keys_changed", details: { count: keys.length } });
  return { success: t("ok.saved") };
}
