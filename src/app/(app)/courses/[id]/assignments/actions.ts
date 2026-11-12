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
import { deleteStoredFile } from "@/lib/storage";
import { incomingFiles } from "@/lib/uploads";
import { AI_ANSWER_LIMIT, AI_SOURCE_PREFIX, AI_ANSWER_VARIANTS, aiAnswersEnabled, generateAiAnswers } from "@/lib/ai-answers";
import { acceptsSubmissions, isPastDue, parseBangkokLocal, uploadLimits } from "@/lib/assignments";
import { config } from "@/lib/config";
import { extractFile, type Extracted } from "@/lib/similarity/extract";
import { assembleContent } from "@/lib/similarity/content";
import { referenceContent } from "@/lib/similarity/sources";
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
  const uploads = await incomingFiles(fd, "files", user);
  const limits = uploadLimits(config.maxUploadMb);
  const reject = async (error: string) => {
    await Promise.all(uploads.map((f) => f.discard()));
    return { error };
  };
  if (uploads.length > limits.maxFiles) return reject(t("err.tooManyFiles", { n: limits.maxFiles }));
  if (uploads.some((f) => f.size > limits.fileMb * 1024 * 1024)) return reject(t("err.fileTooBig", { mb: limits.fileMb }));
  if (uploads.reduce((n, f) => n + f.size, 0) > limits.totalMb * 1024 * 1024) return reject(t("err.filesTooBig", { mb: limits.totalMb }));

  const existing = await db.submission.findUnique({
    where: { assignmentId_studentId: { assignmentId, studentId: user.id } },
    include: { files: { orderBy: { createdAt: "asc" } } },
  });
  if (!textAnswer && uploads.length === 0 && !existing?.files.length) return { error: t("err.emptySubmission") };

  // Store and analyse new files.
  const newFiles: { fileName: string; storageKey: string; mimeType: string; sizeBytes: number; extracted: Extracted[] | null }[] = [];
  for (const f of uploads) {
    const data = await f.bytes();
    const fileName = f.name.slice(0, 255);
    newFiles.push({
      fileName,
      storageKey: await f.store(),
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

// ---------- reference library (in-house internet / past-year checking) ----------

const MAX_REFERENCE_CHARS = 300_000;

/** Add a reference document (pasted text and/or files) the assignment's submissions are compared with. */
export async function addReferenceDocumentAction(assignmentId: string, _: FormState, fd: FormData): Promise<FormState> {
  const assignment = await db.assignment.findUniqueOrThrow({ where: { id: assignmentId } });
  const user = await requireManage(assignment.offeringId);
  const { t } = await getI18n();

  const title = String(fd.get("title") ?? "").trim().slice(0, 200);
  if (!title) return { error: t("err.titleRequired") };
  const urlRaw = String(fd.get("url") ?? "").trim().slice(0, 1000);
  if (urlRaw && !/^https?:\/\/\S+$/i.test(urlRaw)) return { error: t("src.err.url") };
  const text = String(fd.get("text") ?? "").trim().slice(0, MAX_REFERENCE_CHARS) || null;
  const uploads = await incomingFiles(fd, "files", user);
  const limits = uploadLimits(config.maxUploadMb);
  // Only the text of a reference file is kept, so direct uploads are removed again in every case.
  const discardAll = () => Promise.all(uploads.map((f) => f.discard()));
  if (uploads.length > limits.maxFiles) { await discardAll(); return { error: t("err.tooManyFiles", { n: limits.maxFiles }) }; }
  if (uploads.reduce((n, f) => n + f.size, 0) > limits.totalMb * 1024 * 1024) { await discardAll(); return { error: t("err.filesTooBig", { mb: limits.totalMb }) }; }

  const files: { fileName: string; extracted: Extracted[] | null }[] = [];
  for (const f of uploads) {
    const fileName = f.name.slice(0, 255);
    files.push({ fileName, extracted: await extractFile(fileName, await f.bytes()) });
  }
  await discardAll();
  const { content, segments } = referenceContent(text, files);
  if (!content.trim()) return { error: t("src.err.empty") };

  const source = await db.similaritySource.create({
    data: {
      assignmentId,
      kind: "DOCUMENT",
      title,
      url: urlRaw || null,
      content: content.slice(0, MAX_REFERENCE_CHARS),
      segments: segments as Prisma.InputJsonValue,
      createdById: user.id,
    },
  });
  await recheckAssignment(assignmentId);
  await audit({ actorId: user.id, action: "similarity.source_added", targetType: "Assignment", targetId: assignmentId, details: { title, kind: "DOCUMENT", source: source.id } });
  revalidatePath(`/courses/${assignment.offeringId}/assignments/${assignmentId}`, "layout");
  return { success: t("src.added") };
}

/**
 * Ask an AI model the assignment's question a few times and keep the answers as reference documents
 * (lib/ai-answers.ts). Sends only the assignment's title, instructions and starter text.
 */
export async function generateAiAnswersAction(assignmentId: string, _: FormState, _fd: FormData): Promise<FormState> {
  const assignment = await db.assignment.findUniqueOrThrow({ where: { id: assignmentId } });
  const user = await requireManage(assignment.offeringId);
  const { t } = await getI18n();
  if (!aiAnswersEnabled()) return { error: t("ai.err.off") };
  if (!assignment.instructions?.trim()) return { error: t("ai.err.noInstructions") };
  const have = await db.similaritySource.count({ where: { assignmentId, kind: "DOCUMENT", title: { startsWith: AI_SOURCE_PREFIX } } });
  if (have + AI_ANSWER_VARIANTS > AI_ANSWER_LIMIT) return { error: t("ai.err.limit", { n: AI_ANSWER_LIMIT }) };

  const { answers, error } = await generateAiAnswers(assignment.title, assignment.instructions, assignment.baseText);
  if (!answers.length) return { error: t(`ai.err.${error ?? "failed"}`) };
  for (const [i, a] of answers.entries()) {
    const { content, segments } = referenceContent(a.text.slice(0, MAX_REFERENCE_CHARS), []);
    await db.similaritySource.create({
      data: {
        assignmentId,
        kind: "DOCUMENT",
        title: `${AI_SOURCE_PREFIX}${t("ai.sourceTitle", { n: have + i + 1 })} (${a.model})`,
        content,
        segments: segments as Prisma.InputJsonValue,
        createdById: user.id,
      },
    });
  }
  await recheckAssignment(assignmentId);
  await audit({ actorId: user.id, action: "similarity.ai_generated", targetType: "Assignment", targetId: assignmentId, details: { answers: answers.length, model: answers[0].model } });
  revalidatePath(`/courses/${assignment.offeringId}/assignments/${assignmentId}`, "layout");
  return { success: t("ai.added", { n: answers.length }) };
}

/** Compare with every submission to the same course's assignment in an earlier term or another section. */
export async function addPastAssignmentSourceAction(assignmentId: string, _: FormState, fd: FormData): Promise<FormState> {
  const assignment = await db.assignment.findUniqueOrThrow({ where: { id: assignmentId }, include: { offering: true } });
  const user = await requireManage(assignment.offeringId);
  const { t, term } = await getI18n();

  const pastId = String(fd.get("pastAssignmentId") ?? "");
  const past = await db.assignment.findUnique({ where: { id: pastId }, include: { offering: { include: { course: true, term: true } } } });
  // Only the same course in another term or section (never this section's own assignments).
  if (!past || past.offeringId === assignment.offeringId || past.offering.courseId !== assignment.offering.courseId) return { error: t("common.invalid") };
  if (await db.similaritySource.findFirst({ where: { assignmentId, pastAssignmentId: pastId } })) return { error: t("src.err.duplicate") };

  const title = `${past.offering.course.code} · ${term(past.offering.term)} · ${t("tc.section")} ${past.offering.section} — ${past.title}`;
  await db.similaritySource.create({ data: { assignmentId, kind: "PAST_ASSIGNMENT", title: title.slice(0, 200), pastAssignmentId: pastId, createdById: user.id } });
  await recheckAssignment(assignmentId);
  await audit({ actorId: user.id, action: "similarity.source_added", targetType: "Assignment", targetId: assignmentId, details: { title, kind: "PAST_ASSIGNMENT", pastAssignmentId: pastId } });
  revalidatePath(`/courses/${assignment.offeringId}/assignments/${assignmentId}`, "layout");
  return { success: t("src.added") };
}

export async function removeReferenceAction(fd: FormData): Promise<void> {
  const source = await db.similaritySource.findUniqueOrThrow({ where: { id: String(fd.get("sourceId")) }, include: { assignment: true } });
  const user = await requireManage(source.assignment.offeringId);
  await db.similaritySource.delete({ where: { id: source.id } });
  await recheckAssignment(source.assignmentId);
  await audit({ actorId: user.id, action: "similarity.source_removed", targetType: "Assignment", targetId: source.assignmentId, details: { title: source.title } });
  revalidatePath(`/courses/${source.assignment.offeringId}/assignments/${source.assignmentId}`, "layout");
}
