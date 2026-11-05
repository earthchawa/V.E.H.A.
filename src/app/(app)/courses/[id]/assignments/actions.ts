"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import type { FormState } from "@/lib/form";
import { requireUser } from "@/lib/auth/session";
import { offeringAccess } from "@/lib/access";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getI18n } from "@/lib/i18n/server";
import { deleteStoredFile, saveBuffer } from "@/lib/storage";
import { acceptsSubmissions, isPastDue, parseBangkokLocal, uploadLimits } from "@/lib/assignments";
import { config } from "@/lib/config";
import { extractFile, type Extracted } from "@/lib/similarity/extract";
import { assembleContent } from "@/lib/similarity/content";
import { recheckAssignment } from "@/lib/similarity/run";
import { copyAssignment, validTargets } from "@/lib/sections";

async function requireManage(offeringId: string) {
  const user = await requireUser();
  if ((await offeringAccess(user, offeringId)) !== "manage") throw new Error("forbidden");
  return user;
}

const VIS = ["IMMEDIATE", "AFTER_DUE", "HIDDEN"] as const;

/** Create (assignmentId = null) or update an assignment. */
export async function saveAssignmentAction(
  offeringId: string,
  assignmentId: string | null,
  _: FormState,
  fd: FormData,
): Promise<FormState> {
  const user = await requireManage(offeringId);
  const { t } = await getI18n();

  const title = String(fd.get("title") ?? "").trim().slice(0, 200);
  if (!title) return { error: t("err.titleRequired") };
  const dueRaw = String(fd.get("dueAt") ?? "");
  const dueAt = parseBangkokLocal(dueRaw);
  if (dueRaw && !dueAt) return { error: t("err.dueInvalid") };
  const vis = String(fd.get("reportVisibility"));

  const data = {
    title,
    instructions: String(fd.get("instructions") ?? "").trim().slice(0, 20000) || null,
    dueAt,
    allowLate: fd.get("allowLate") === "on",
    isPublished: fd.get("isPublished") === "on",
    checkSimilarity: fd.get("checkSimilarity") === "on",
    ignoreCommon: fd.get("ignoreCommon") === "on",
    reportVisibility: (VIS as readonly string[]).includes(vis) ? (vis as (typeof VIS)[number]) : "IMMEDIATE",
    baseText: String(fd.get("baseText") ?? "").trim().slice(0, 100000) || null,
  };

  const pointsRaw = String(fd.get("points") ?? "").trim();
  const points = pointsRaw ? Number(pointsRaw) : null;
  if (points != null && (!Number.isFinite(points) || points <= 0)) return { error: t("err.maxPoints") };
  const catRaw = String(fd.get("categoryId") ?? "");
  const category = catRaw ? await db.gradeCategory.findUnique({ where: { id: catRaw } }) : null;
  const categoryId = category && category.offeringId === offeringId ? category.id : null;

  /** Keep the linked gradebook column in step. Clearing the points leaves an existing column (and its scores) alone. */
  const syncGradeItem = async (id: string) => {
    if (points == null) return;
    const position = await db.gradeItem.count({ where: { offeringId } });
    await db.gradeItem.upsert({
      where: { assignmentId: id },
      create: { offeringId, assignmentId: id, title, maxPoints: points, categoryId, position },
      update: { title, maxPoints: points, categoryId },
    });
  };

  if (assignmentId) {
    const existing = await db.assignment.findUniqueOrThrow({ where: { id: assignmentId } });
    if (existing.offeringId !== offeringId) throw new Error("forbidden");
    await db.assignment.update({ where: { id: assignmentId }, data });
    await syncGradeItem(assignmentId);
    // Starter text or the on/off switch changes the results.
    if (
      existing.baseText !== data.baseText ||
      existing.instructions !== data.instructions ||
      existing.checkSimilarity !== data.checkSimilarity ||
      existing.ignoreCommon !== data.ignoreCommon
    )
      await recheckAssignment(assignmentId);
    await audit({ actorId: user.id, action: "assignment.updated", targetType: "Assignment", targetId: assignmentId });
    revalidatePath(`/courses/${offeringId}/assignments`, "layout");
    return { success: t("ok.assignmentSaved") };
  }

  const created = await db.assignment.create({ data: { ...data, offeringId, createdById: user.id } });
  await syncGradeItem(created.id);
  for (const target of await validTargets(user, offeringId, fd.getAll("alsoTo"))) {
    await copyAssignment(created.id, target.id, user.id);
    revalidatePath(`/courses/${target.id}/assignments`);
  }
  await audit({ actorId: user.id, action: "assignment.created", targetType: "Assignment", targetId: created.id });
  redirect(`/courses/${offeringId}/assignments/${created.id}`);
}

export async function deleteAssignmentAction(fd: FormData): Promise<void> {
  const assignment = await db.assignment.findUniqueOrThrow({
    where: { id: String(fd.get("assignmentId")) },
    include: { submissions: { include: { files: true } } },
  });
  const user = await requireManage(assignment.offeringId);
  await db.assignment.delete({ where: { id: assignment.id } });
  for (const s of assignment.submissions) for (const f of s.files) await deleteStoredFile(f.storageKey);
  await audit({
    actorId: user.id,
    action: "assignment.deleted",
    targetType: "Assignment",
    targetId: assignment.id,
    offeringId: assignment.offeringId,
    details: { title: assignment.title, submissions: assignment.submissions.length },
  });
  redirect(`/courses/${assignment.offeringId}/assignments`);
}

export async function recheckAction(_: FormState, fd: FormData): Promise<FormState> {
  const assignment = await db.assignment.findUniqueOrThrow({ where: { id: String(fd.get("assignmentId")) } });
  const user = await requireManage(assignment.offeringId);
  const { t } = await getI18n();
  await recheckAssignment(assignment.id);
  await audit({ actorId: user.id, action: "similarity.rechecked", targetType: "Assignment", targetId: assignment.id });
  revalidatePath(`/courses/${assignment.offeringId}/assignments/${assignment.id}`, "layout");
  return { success: t("ok.rechecked") };
}

/** A cadet submits (or resubmits) their work. New files replace the old ones; no new files keeps them. */
export async function submitAction(assignmentId: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const { t } = await getI18n();
  const assignment = await db.assignment.findUniqueOrThrow({ where: { id: assignmentId } });

  const enrollment = await db.enrollment.findUnique({
    where: { userId_offeringId: { userId: user.id, offeringId: assignment.offeringId } },
  });
  if (!enrollment || enrollment.role !== "STUDENT" || !assignment.isPublished) return { error: t("err.notEnrolledStudent") };
  const now = new Date();
  if (!acceptsSubmissions(assignment, now)) return { error: t("err.submissionClosed") };

  const textAnswer = String(fd.get("textAnswer") ?? "").trim().slice(0, 100000) || null;
  const uploads = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const limits = uploadLimits(config.maxUploadMb);
  if (uploads.length > limits.maxFiles) return { error: t("err.tooManyFiles", { n: limits.maxFiles }) };
  if (uploads.some((f) => f.size > limits.fileMb * 1024 * 1024)) return { error: t("err.fileTooBig", { mb: limits.fileMb }) };
  if (uploads.reduce((n, f) => n + f.size, 0) > limits.totalMb * 1024 * 1024)
    return { error: t("err.filesTooBig", { mb: limits.totalMb }) };

  const existing = await db.submission.findUnique({
    where: { assignmentId_studentId: { assignmentId, studentId: user.id } },
    include: { files: { orderBy: { createdAt: "asc" } } },
  });
  if (!textAnswer && uploads.length === 0 && !existing?.files.length) return { error: t("err.emptySubmission") };

  // Store and analyse new files.
  const newFiles: { fileName: string; storageKey: string; mimeType: string; sizeBytes: number; extracted: Extracted[] | null }[] = [];
  for (const f of uploads) {
    const data = Buffer.from(await f.arrayBuffer());
    const fileName = f.name.slice(0, 255);
    newFiles.push({
      fileName,
      storageKey: await saveBuffer(data),
      mimeType: f.type || "application/octet-stream",
      sizeBytes: f.size,
      extracted: await extractFile(fileName, data),
    });
  }
  const keptFiles = uploads.length
    ? []
    : (existing?.files ?? []).map((f) => ({ fileName: f.fileName, extracted: f.extracted as Extracted[] | null }));
  const { content, segments } = assembleContent(textAnswer, uploads.length ? newFiles : keptFiles);

  const isLate = isPastDue(assignment, now);
  const fields = {
    textAnswer,
    content,
    segments: segments as Prisma.InputJsonValue,
    isLate,
    submittedAt: now,
    similarity: null,
    checkedAt: null,
  };
  const fileRows = newFiles.map((f) => ({ ...f, extracted: (f.extracted ?? undefined) as Prisma.InputJsonValue | undefined }));

  let submissionId: string;
  if (existing) {
    const oldKeys = uploads.length ? existing.files.map((f) => f.storageKey) : [];
    await db.$transaction([
      ...(uploads.length ? [db.submissionFile.deleteMany({ where: { submissionId: existing.id } })] : []),
      db.submission.update({
        where: { id: existing.id },
        data: { ...fields, version: existing.version + 1, files: { create: fileRows } },
      }),
    ]);
    for (const k of oldKeys) await deleteStoredFile(k);
    submissionId = existing.id;
  } else {
    const created = await db.submission.create({
      data: { ...fields, assignmentId, studentId: user.id, files: { create: fileRows } },
    });
    submissionId = created.id;
  }

  await audit({
    actorId: user.id,
    action: existing ? "submission.resubmitted" : "submission.created",
    targetType: "Submission",
    targetId: submissionId,
    details: { assignmentId, late: isLate, files: uploads.length },
  });
  await recheckAssignment(assignmentId);
  revalidatePath(`/courses/${assignment.offeringId}/assignments`, "layout");
  return { success: t(isLate ? "ok.submittedLate" : "ok.submitted") };
}

/** Copy an assignment (settings + gradebook column, never submissions) to other sections. */
export async function copyAssignmentAction(_: FormState, fd: FormData): Promise<FormState> {
  const assignment = await db.assignment.findUniqueOrThrow({ where: { id: String(fd.get("itemId")) } });
  const user = await requireManage(assignment.offeringId);
  const { t } = await getI18n();
  const targets = await validTargets(user, assignment.offeringId, fd.getAll("target"));
  if (!targets.length) return { error: t("sec.chooseTarget") };
  for (const target of targets) {
    await copyAssignment(assignment.id, target.id, user.id);
    revalidatePath(`/courses/${target.id}`, "layout");
  }
  await audit({ actorId: user.id, action: "assignment.copied", targetType: "Assignment", targetId: assignment.id, details: { to: targets.map((x) => x.id) } });
  return { success: t("sec.copied", { list: targets.map((x) => t("dash.section", { s: x.section })).join(", ") }) };
}
