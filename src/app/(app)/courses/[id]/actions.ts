"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/lib/form";
import { requireUser } from "@/lib/auth/session";
import { offeringAccess } from "@/lib/access";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { config } from "@/lib/config";
import { deleteStoredFile, saveFile } from "@/lib/storage";
import { getI18n } from "@/lib/i18n/server";
import { copyMaterial, validTargets } from "@/lib/sections";

async function requireManage(offeringId: string) {
  const user = await requireUser();
  if ((await offeringAccess(user, offeringId)) !== "manage") throw new Error("forbidden");
  return user;
}

const materialSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  week: z.coerce.number().int().min(0).max(30).optional(),
  type: z.enum(["FILE", "LINK"]),
  url: z.string().trim().optional(),
  isPublished: z.boolean(),
});

export async function addMaterialAction(offeringId: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireManage(offeringId);
  const { t } = await getI18n();
  const parsed = materialSchema.safeParse({
    title: fd.get("title"),
    description: fd.get("description") || undefined,
    week: fd.get("week") || undefined,
    type: fd.get("type"),
    url: fd.get("url") || undefined,
    isPublished: fd.get("isPublished") === "on",
  });
  if (!parsed.success)
    return { error: t(parsed.error.issues[0]?.path[0] === "title" ? "err.titleRequired" : "common.invalid") };
  const m = parsed.data;

  let fileData: { fileName: string; storageKey: string; mimeType: string; sizeBytes: number } | undefined;
  let url: string | undefined;

  if (m.type === "LINK") {
    if (!m.url || !z.url({ protocol: /^https?$/ }).safeParse(m.url).success)
      return { error: t("err.badUrl") };
    url = m.url;
  } else {
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: t("err.chooseFile") };
    if (file.size > config.maxUploadMb * 1024 * 1024) return { error: t("err.fileTooBig", { mb: config.maxUploadMb }) };
    fileData = {
      fileName: file.name.slice(0, 255),
      storageKey: await saveFile(file),
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
    };
  }

  const material = await db.material.create({
    data: {
      offeringId,
      title: m.title,
      description: m.description,
      week: m.week,
      type: m.type,
      url,
      ...fileData,
      isPublished: m.isPublished,
      createdById: user.id,
    },
  });
  await audit({ actorId: user.id, action: "material.created", targetType: "Material", targetId: material.id });
  // "Also add to" other sections of the same course.
  for (const target of await validTargets(user, offeringId, fd.getAll("alsoTo"))) {
    await copyMaterial(material.id, target.id, user.id);
    revalidatePath(`/courses/${target.id}`);
  }
  revalidatePath(`/courses/${offeringId}`);
  return { success: t("ok.materialAdded") };
}

async function loadOwnMaterial(fd: FormData) {
  const material = await db.material.findUniqueOrThrow({ where: { id: String(fd.get("materialId")) } });
  const user = await requireManage(material.offeringId);
  return { material, user };
}

export async function toggleMaterialAction(fd: FormData): Promise<void> {
  const { material, user } = await loadOwnMaterial(fd);
  await db.material.update({ where: { id: material.id }, data: { isPublished: !material.isPublished } });
  await audit({
    actorId: user.id,
    action: material.isPublished ? "material.unpublished" : "material.published",
    targetType: "Material",
    targetId: material.id,
  });
  revalidatePath(`/courses/${material.offeringId}`);
}

export async function deleteMaterialAction(fd: FormData): Promise<void> {
  const { material, user } = await loadOwnMaterial(fd);
  await db.material.delete({ where: { id: material.id } });
  if (material.storageKey) await deleteStoredFile(material.storageKey);
  await audit({
    actorId: user.id,
    action: "material.deleted",
    targetType: "Material",
    targetId: material.id,
    details: { title: material.title },
  });
  revalidatePath(`/courses/${material.offeringId}`);
}

/** Copy an existing material to other sections of the same course. */
export async function copyMaterialAction(_: FormState, fd: FormData): Promise<FormState> {
  const material = await db.material.findUniqueOrThrow({ where: { id: String(fd.get("itemId")) } });
  const user = await requireManage(material.offeringId);
  const { t } = await getI18n();
  const targets = await validTargets(user, material.offeringId, fd.getAll("target"));
  if (!targets.length) return { error: t("sec.chooseTarget") };
  for (const target of targets) {
    await copyMaterial(material.id, target.id, user.id);
    revalidatePath(`/courses/${target.id}`);
  }
  await audit({ actorId: user.id, action: "material.copied", targetType: "Material", targetId: material.id, details: { to: targets.map((x) => x.id) } });
  return { success: t("sec.copied", { list: targets.map((x) => t("dash.section", { s: x.section })).join(", ") }) };
}
