"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import type { FormState } from "@/lib/form";
import { requireUser } from "@/lib/auth/session";
import { canGrade } from "@/lib/access";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getI18n } from "@/lib/i18n/server";
import { normaliseScale } from "@/lib/grades";
import { copyGradebookSetup, validTargets } from "@/lib/sections";

/** Gradebook changes are for the course's own instructors (not admins, not cadets). */
async function requireManage(offeringId: string) {
  const user = await requireUser();
  if (!(await canGrade(user, offeringId))) throw new Error("forbidden");
  return user;
}

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

const refresh = (offeringId: string) => revalidatePath(`/courses/${offeringId}`, "layout");

// ---------- Categories ----------

export async function addCategoryAction(offeringId: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireManage(offeringId);
  const { t } = await getI18n();
  const name = String(fd.get("name") ?? "").trim().slice(0, 80);
  const weight = num(fd.get("weight"));
  if (!name) return { error: t("err.nameRequired") };
  if (weight == null || Number.isNaN(weight) || weight < 0 || weight > 100) return { error: t("err.weight") };
  const position = await db.gradeCategory.count({ where: { offeringId } });
  const c = await db.gradeCategory.create({ data: { offeringId, name, weight, position } });
  await audit({ actorId: user.id, action: "grade.category_added", targetType: "GradeCategory", targetId: c.id, details: { name, weight } });
  refresh(offeringId);
  return { success: t("ok.saved") };
}

export async function updateCategoryAction(_: FormState, fd: FormData): Promise<FormState> {
  const cat = await db.gradeCategory.findUniqueOrThrow({ where: { id: String(fd.get("categoryId")) } });
  const user = await requireManage(cat.offeringId);
  const { t } = await getI18n();
  const name = String(fd.get("name") ?? "").trim().slice(0, 80);
  const weight = num(fd.get("weight"));
  if (!name) return { error: t("err.nameRequired") };
  if (weight == null || Number.isNaN(weight) || weight < 0 || weight > 100) return { error: t("err.weight") };
  await db.gradeCategory.update({ where: { id: cat.id }, data: { name, weight } });
  await audit({
    actorId: user.id,
    action: "grade.category_updated",
    targetType: "GradeCategory",
    targetId: cat.id,
    details: { from: { name: cat.name, weight: cat.weight }, to: { name, weight } },
  });
  refresh(cat.offeringId);
  return { success: t("ok.saved") };
}

export async function deleteCategoryAction(fd: FormData): Promise<void> {
  const cat = await db.gradeCategory.findUniqueOrThrow({ where: { id: String(fd.get("categoryId")) } });
  const user = await requireManage(cat.offeringId);
  await db.gradeCategory.delete({ where: { id: cat.id } });
  await audit({ actorId: user.id, action: "grade.category_deleted", targetType: "GradeCategory", targetId: cat.id, details: { name: cat.name } });
  refresh(cat.offeringId);
}

// ---------- Items ----------

export async function addItemAction(offeringId: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireManage(offeringId);
  const { t } = await getI18n();
  const title = String(fd.get("title") ?? "").trim().slice(0, 200);
  const maxPoints = num(fd.get("maxPoints"));
  if (!title) return { error: t("err.titleRequired") };
  if (maxPoints == null || Number.isNaN(maxPoints) || maxPoints <= 0) return { error: t("err.maxPoints") };
  const categoryId = await validCategory(offeringId, fd.get("categoryId"));
  const position = await db.gradeItem.count({ where: { offeringId } });
  const item = await db.gradeItem.create({
    data: { offeringId, title, maxPoints, categoryId, position, isReleased: fd.get("isReleased") === "on" },
  });
  await audit({ actorId: user.id, action: "grade.item_added", targetType: "GradeItem", targetId: item.id, details: { title, maxPoints } });
  refresh(offeringId);
  return { success: t("ok.saved") };
}

async function validCategory(offeringId: string, raw: FormDataEntryValue | null): Promise<string | null> {
  const id = String(raw ?? "");
  if (!id) return null;
  const c = await db.gradeCategory.findUnique({ where: { id } });
  return c && c.offeringId === offeringId ? c.id : null;
}

export async function toggleItemReleaseAction(fd: FormData): Promise<void> {
  const item = await db.gradeItem.findUniqueOrThrow({ where: { id: String(fd.get("itemId")) } });
  const user = await requireManage(item.offeringId);
  await db.gradeItem.update({ where: { id: item.id }, data: { isReleased: !item.isReleased } });
  await audit({ actorId: user.id, action: item.isReleased ? "grade.item_hidden" : "grade.item_released", targetType: "GradeItem", targetId: item.id });
  refresh(item.offeringId);
}

export async function deleteItemAction(fd: FormData): Promise<void> {
  const item = await db.gradeItem.findUniqueOrThrow({ where: { id: String(fd.get("itemId")) }, include: { _count: { select: { grades: true } } } });
  const user = await requireManage(item.offeringId);
  await db.gradeItem.delete({ where: { id: item.id } });
  await audit({
    actorId: user.id,
    action: "grade.item_deleted",
    targetType: "GradeItem",
    targetId: item.id,
    details: { title: item.title, grades: item._count.grades },
  });
  refresh(item.offeringId);
}

// ---------- Scale & settings ----------

export async function saveScaleAction(offeringId: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireManage(offeringId);
  const { t } = await getI18n();
  let scale: Prisma.InputJsonValue | typeof Prisma.DbNull;
  if (fd.get("reset") === "1") scale = Prisma.DbNull;
  else {
    const letters = fd.getAll("letter").map(String);
    const mins = fd.getAll("min").map((v) => Number(v));
    if (mins.some((m) => !Number.isFinite(m) || m < 0 || m > 100)) return { error: t("common.invalid") };
    scale = normaliseScale(letters.map((letter, i) => ({ letter, min: mins[i] })));
  }
  await db.courseOffering.update({ where: { id: offeringId }, data: { gradeScale: scale } });
  await audit({ actorId: user.id, action: "grade.scale_changed", targetType: "CourseOffering", targetId: offeringId });
  refresh(offeringId);
  return { success: t("ok.saved") };
}

export async function toggleShowTotalAction(fd: FormData): Promise<void> {
  const offeringId = String(fd.get("offeringId"));
  const user = await requireManage(offeringId);
  const o = await db.courseOffering.findUniqueOrThrow({ where: { id: offeringId } });
  await db.courseOffering.update({ where: { id: offeringId }, data: { showTotalToStudents: !o.showTotalToStudents } });
  await audit({ actorId: user.id, action: "grade.show_total_toggled", targetType: "CourseOffering", targetId: offeringId, details: { to: !o.showTotalToStudents } });
  refresh(offeringId);
}

// ---------- Scores ----------

export type ScoreChange = { itemId: string; studentId: string; points: number | null };

/** Save a batch of edited cells from the gradebook grid. All-or-nothing. */
export async function saveGradesAction(offeringId: string, changes: ScoreChange[]): Promise<FormState> {
  const user = await requireManage(offeringId);
  const { t } = await getI18n();
  if (!Array.isArray(changes) || changes.length === 0) return { success: t("ok.gradesSaved", { n: 0 }) };

  const [items, enrolled] = await Promise.all([
    db.gradeItem.findMany({ where: { offeringId } }),
    db.enrollment.findMany({ where: { offeringId, role: "STUDENT" }, select: { userId: true } }),
  ]);
  const itemById = new Map(items.map((i) => [i.id, i]));
  const students = new Set(enrolled.map((e) => e.userId));

  for (const c of changes) {
    const item = itemById.get(c.itemId);
    if (!item || !students.has(c.studentId)) return { error: t("common.invalid") };
    if (c.points != null && (!Number.isFinite(c.points) || c.points < 0 || c.points > item.maxPoints))
      return { error: t("gr.invalidScore", { title: item.title, max: item.maxPoints }) };
  }

  const before = await db.grade.findMany({
    where: { OR: changes.map((c) => ({ itemId: c.itemId, studentId: c.studentId })) },
  });
  const prev = new Map(before.map((g) => [`${g.itemId}:${g.studentId}`, g.points]));

  await db.$transaction(
    changes.map((c) =>
      db.grade.upsert({
        where: { itemId_studentId: { itemId: c.itemId, studentId: c.studentId } },
        create: { itemId: c.itemId, studentId: c.studentId, points: c.points, gradedById: user.id },
        update: { points: c.points, gradedById: user.id },
      }),
    ),
  );
  await audit({
    actorId: user.id,
    action: "grade.changed",
    targetType: "CourseOffering",
    targetId: offeringId,
    details: changes.map((c) => ({ item: c.itemId, student: c.studentId, from: prev.get(`${c.itemId}:${c.studentId}`) ?? null, to: c.points })),
  });
  refresh(offeringId);
  return { success: t("ok.gradesSaved", { n: changes.length }) };
}

/** Grade one submission (points + feedback) from the report page. */
export async function gradeSubmissionAction(itemId: string, studentId: string, _: FormState, fd: FormData): Promise<FormState> {
  const item = await db.gradeItem.findUniqueOrThrow({ where: { id: itemId } });
  const user = await requireManage(item.offeringId);
  const { t } = await getI18n();
  const points = num(fd.get("points"));
  if (points != null && (Number.isNaN(points) || points < 0 || points > item.maxPoints))
    return { error: t("gr.invalidScore", { title: item.title, max: item.maxPoints }) };
  const feedback = String(fd.get("feedback") ?? "").trim().slice(0, 5000) || null;
  const enrolled = await db.enrollment.findUnique({ where: { userId_offeringId: { userId: studentId, offeringId: item.offeringId } } });
  if (!enrolled || enrolled.role !== "STUDENT") return { error: t("common.invalid") };

  const prev = await db.grade.findUnique({ where: { itemId_studentId: { itemId, studentId } } });
  await db.grade.upsert({
    where: { itemId_studentId: { itemId, studentId } },
    create: { itemId, studentId, points, feedback, gradedById: user.id },
    update: { points, feedback, gradedById: user.id },
  });
  await audit({
    actorId: user.id,
    action: "grade.changed",
    targetType: "GradeItem",
    targetId: itemId,
    details: [{ item: itemId, student: studentId, from: prev?.points ?? null, to: points }],
  });
  refresh(item.offeringId);
  return { success: t("ok.saved") };
}


/** Copy categories, weights, grade scale and standalone items to other sections (never scores). */
export async function copyGradebookSetupAction(_: FormState, fd: FormData): Promise<FormState> {
  const offeringId = String(fd.get("itemId"));
  const user = await requireManage(offeringId);
  const { t } = await getI18n();
  const targets = await validTargets(user, offeringId, fd.getAll("target"));
  if (!targets.length) return { error: t("sec.chooseTarget") };
  for (const target of targets) {
    await copyGradebookSetup(offeringId, target.id);
    refresh(target.id);
  }
  await audit({ actorId: user.id, action: "grade.setup_copied", targetType: "CourseOffering", targetId: offeringId, details: { to: targets.map((x) => x.id) } });
  return { success: t("sec.copied", { list: targets.map((x) => t("dash.section", { s: x.section })).join(", ") }) };
}
