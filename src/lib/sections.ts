import type { Prisma } from "@prisma/client";
import type { SessionUser } from "./auth/session";
import { db } from "./db";
import { readStoredFile, saveBuffer } from "./storage";

/**
 * Other sections of the same course in the same term that this user can manage
 * (admins: all; instructors: the ones they teach).
 */
export async function siblingSections(user: SessionUser, offeringId: string): Promise<{ id: string; section: string }[]> {
  const o = await db.courseOffering.findUnique({ where: { id: offeringId }, select: { courseId: true, termId: true } });
  if (!o) return [];
  return db.courseOffering.findMany({
    where: {
      courseId: o.courseId,
      termId: o.termId,
      NOT: { id: offeringId },
      ...(user.role === "ADMIN" ? {} : { enrollments: { some: { userId: user.id, role: "INSTRUCTOR" } } }),
    },
    select: { id: true, section: true },
    orderBy: { section: "asc" },
  });
}

/** Keep only target ids that really are manageable sibling sections. */
export async function validTargets(user: SessionUser, offeringId: string, raw: FormDataEntryValue[]): Promise<{ id: string; section: string }[]> {
  const wanted = new Set(raw.map(String));
  return (await siblingSections(user, offeringId)).filter((s) => wanted.has(s.id));
}

/** Copy a material; files get their own copy so deleting one section's material never breaks another. */
export async function copyMaterial(materialId: string, targetOfferingId: string, userId: string): Promise<void> {
  const m = await db.material.findUniqueOrThrow({ where: { id: materialId } });
  const storageKey = m.storageKey ? await saveBuffer(await readStoredFile(m.storageKey)) : null;
  await db.material.create({
    data: {
      offeringId: targetOfferingId,
      title: m.title,
      description: m.description,
      week: m.week,
      type: m.type,
      fileName: m.fileName,
      storageKey,
      mimeType: m.mimeType,
      sizeBytes: m.sizeBytes,
      url: m.url,
      isPublished: m.isPublished,
      createdById: userId,
    },
  });
}

/** Category in the target section with the same name (created if missing). */
async function matchingCategory(sourceCategoryId: string | null, targetOfferingId: string): Promise<string | null> {
  if (!sourceCategoryId) return null;
  const src = await db.gradeCategory.findUnique({ where: { id: sourceCategoryId } });
  if (!src) return null;
  const existing = await db.gradeCategory.findFirst({ where: { offeringId: targetOfferingId, name: src.name } });
  if (existing) return existing.id;
  const position = await db.gradeCategory.count({ where: { offeringId: targetOfferingId } });
  return (await db.gradeCategory.create({ data: { offeringId: targetOfferingId, name: src.name, weight: src.weight, position } })).id;
}

/** Copy an assignment's settings (and its gradebook column). Submissions and scores are never copied. */
export async function copyAssignment(assignmentId: string, targetOfferingId: string, userId: string): Promise<string> {
  const a = await db.assignment.findUniqueOrThrow({ where: { id: assignmentId }, include: { gradeItem: true } });
  const created = await db.assignment.create({
    data: {
      offeringId: targetOfferingId,
      title: a.title,
      instructions: a.instructions,
      dueAt: a.dueAt,
      allowLate: a.allowLate,
      isPublished: a.isPublished,
      checkSimilarity: a.checkSimilarity,
      ignoreCommon: a.ignoreCommon,
      reportVisibility: a.reportVisibility,
      baseText: a.baseText,
      createdById: userId,
    },
  });
  if (a.gradeItem) {
    const position = await db.gradeItem.count({ where: { offeringId: targetOfferingId } });
    await db.gradeItem.create({
      data: {
        offeringId: targetOfferingId,
        assignmentId: created.id,
        title: a.gradeItem.title,
        maxPoints: a.gradeItem.maxPoints,
        categoryId: await matchingCategory(a.gradeItem.categoryId, targetOfferingId),
        isReleased: false,
        position,
      },
    });
  }
  return created.id;
}

/**
 * Copy gradebook setup: categories (matched by name, weights updated), grade scale, the
 * "show total" setting and standalone items (matched by title). Scores are never copied.
 */
export async function copyGradebookSetup(sourceOfferingId: string, targetOfferingId: string): Promise<void> {
  const src = await db.courseOffering.findUniqueOrThrow({
    where: { id: sourceOfferingId },
    include: {
      gradeCategories: { orderBy: { position: "asc" } },
      gradeItems: { where: { assignmentId: null }, orderBy: { position: "asc" } },
    },
  });
  await db.courseOffering.update({
    where: { id: targetOfferingId },
    data: {
      gradeScale: (src.gradeScale ?? undefined) as Prisma.InputJsonValue | undefined,
      showTotalToStudents: src.showTotalToStudents,
    },
  });
  for (const c of src.gradeCategories) {
    const existing = await db.gradeCategory.findFirst({ where: { offeringId: targetOfferingId, name: c.name } });
    if (existing) await db.gradeCategory.update({ where: { id: existing.id }, data: { weight: c.weight, position: c.position } });
    else await db.gradeCategory.create({ data: { offeringId: targetOfferingId, name: c.name, weight: c.weight, position: c.position } });
  }
  for (const i of src.gradeItems) {
    if (await db.gradeItem.findFirst({ where: { offeringId: targetOfferingId, title: i.title, assignmentId: null } })) continue;
    const position = await db.gradeItem.count({ where: { offeringId: targetOfferingId } });
    await db.gradeItem.create({
      data: {
        offeringId: targetOfferingId,
        title: i.title,
        maxPoints: i.maxPoints,
        categoryId: await matchingCategory(i.categoryId, targetOfferingId),
        isReleased: false,
        position,
      },
    });
  }
}
