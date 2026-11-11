import type { SessionUser } from "./auth/session";
import { blobSize, deleteStoredFile, isUserUploadKey, readStoredFile, saveBuffer } from "./storage";

/**
 * A file that arrived with a form: either posted as bytes, or — with Blob storage — uploaded by the browser
 * straight to the store and posted as a reference (see components/direct-upload.ts).
 */
export type IncomingFile = {
  name: string;
  type: string;
  size: number;
  bytes(): Promise<Buffer>;
  /** Keep the file; returns its storage key. */
  store(): Promise<string>;
  /** Not keeping it (validation failed, or only its text was needed): remove a direct upload again. */
  discard(): Promise<void>;
};

export const BLOB_REF = "blobref:";
export type BlobRef = { key: string; name: string; type: string; size: number };

export function parseBlobRef(value: string): BlobRef | null {
  if (!value.startsWith(BLOB_REF)) return null;
  try {
    const r = JSON.parse(value.slice(BLOB_REF.length)) as Partial<BlobRef>;
    if (typeof r.key !== "string" || typeof r.name !== "string") return null;
    return { key: r.key, name: r.name.slice(0, 255), type: typeof r.type === "string" ? r.type.slice(0, 200) : "", size: Number(r.size) || 0 };
  } catch {
    return null;
  }
}

/**
 * The files of one form field. References are only accepted for the user's own uploads ("u/<their id>/…"),
 * and the size comes from the store, not from what the browser claimed.
 */
export async function incomingFiles(fd: FormData, field: string, user: SessionUser): Promise<IncomingFile[]> {
  const out: IncomingFile[] = [];
  for (const v of fd.getAll(field)) {
    if (v instanceof File) {
      if (v.size === 0) continue;
      let data: Buffer | null = null;
      const bytes = async () => (data ??= Buffer.from(await v.arrayBuffer()));
      out.push({ name: v.name, type: v.type, size: v.size, bytes, store: async () => saveBuffer(await bytes()), discard: async () => undefined });
      continue;
    }
    const ref = parseBlobRef(v);
    if (!ref || !isUserUploadKey(ref.key, user.id)) continue;
    const size = await blobSize(ref.key);
    if (size == null || size === 0) continue;
    let data: Buffer | null = null;
    out.push({
      name: ref.name,
      type: ref.type,
      size,
      bytes: async () => (data ??= await readStoredFile(ref.key)),
      store: async () => ref.key,
      discard: () => deleteStoredFile(ref.key).catch(() => undefined),
    });
  }
  return out;
}
