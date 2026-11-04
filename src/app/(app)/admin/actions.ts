"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/lib/form";
import { requireRole } from "@/lib/auth/session";
import { issueTempPassword } from "@/lib/auth/account";
import { generateTempPassword, hashPassword, tempPasswordExpiry } from "@/lib/auth/password";
import { parseUserImport, type UserImportRow } from "@/lib/csv";
import { config } from "@/lib/config";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getI18n } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n";

export type IssuedPassword = { username: string; fullName: string; password: string };

const admin = () => requireRole("ADMIN");

// ---------- Users ----------

async function createUsers(actorId: string, rows: UserImportRow[], t: Translator["t"]) {
  const existing = new Set(
    (await db.user.findMany({ where: { username: { in: rows.map((r) => r.username) } }, select: { username: true } }))
      .map((u) => u.username),
  );
  const emails = rows.map((r) => r.email).filter((e): e is string => !!e);
  const takenEmails = new Set(
    (await db.user.findMany({ where: { email: { in: emails } }, select: { email: true } })).map((u) => u.email),
  );

  const issued: IssuedPassword[] = [];
  const skipped: string[] = [];
  for (const r of rows) {
    if (existing.has(r.username)) { skipped.push(t("users.skip.exists", { id: r.username })); continue; }
    if (r.email && takenEmails.has(r.email)) { skipped.push(t("users.skip.email", { id: r.username })); continue; }
    const password = generateTempPassword();
    await db.user.create({
      data: {
        username: r.username,
        fullName: r.fullName,
        role: r.role,
        email: r.email,
        passwordHash: await hashPassword(password),
        mustChangePassword: true,
        tempPasswordExpiresAt: tempPasswordExpiry(config.tempPasswordDays),
      },
    });
    issued.push({ username: r.username, fullName: r.fullName, password });
  }
  if (issued.length)
    await audit({ actorId, action: "user.created", details: { usernames: issued.map((i) => i.username) } });
  return { issued, skipped };
}

export async function createUserAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await admin();
  const { t, tm } = await getI18n();
  const line = [fd.get("username"), fd.get("fullName"), fd.get("role"), fd.get("email")]
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
  const { issued, skipped } = await createUsers(me.id, rows, t);
  revalidatePath("/admin/users");
  return {
    success:
      tn("ok.imported", issued.length) +
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
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { error: t(field === "code" ? "err.courseCode" : field === "title" ? "err.courseTitle" : "common.invalid") };
  }
  if (await db.course.findUnique({ where: { code: parsed.data.code } })) return { error: t("err.courseExists") };
  const course = await db.course.create({ data: parsed.data });
  await audit({ actorId: me.id, action: "course.created", targetType: "Course", targetId: course.id });
  revalidatePath("/admin/courses");
  return { success: t("ok.courseAdded", { code: course.code }) };
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
