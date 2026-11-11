import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { del, get, put } from "@vercel/blob";
import { config } from "./config";
import { db } from "./db";

/**
 * Uploaded files are stored under random keys; original names live only in the database.
 *
 * Three stores, told apart by the key so files saved before a switch stay readable:
 *  - Vercel Blob (private access): keys are Blob pathnames, "f/<uuid>" (saved by the server) or
 *    "u/<userId>/<uuid>" (uploaded straight from that user's browser, see lib/uploads.ts);
 *  - plain "<uuid>" keys live in the legacy store: the disk under UPLOAD_DIR (self-hosted) or the
 *    StoredFile table in Postgres (Vercel without Blob).
 * Files are only ever served through our own routes, after the permission check.
 */
const UUID = "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}";
const BLOB_KEY = new RegExp(`^(f/${UUID}|u/[a-z0-9]{10,40}/${UUID})$`);
const LEGACY_KEY = new RegExp(`^${UUID}$`);

export const isBlobKey = (key: string) => BLOB_KEY.test(key);
/** The Blob pathname prefix a user's own browser uploads must have. */
export const userUploadPrefix = (userId: string) => `u/${userId}/`;
export const isUserUploadKey = (key: string, userId: string) => isBlobKey(key) && key.startsWith(userUploadPrefix(userId));

function checkKey(key: string): string {
  if (!LEGACY_KEY.test(key)) throw new Error("invalid storage key");
  return key;
}

function diskPath(key: string): string {
  return path.join(path.resolve(config.uploadDir), key.slice(0, 2), checkKey(key));
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  return Buffer.from(await new Response(stream).arrayBuffer());
}

export async function saveBuffer(data: Buffer): Promise<string> {
  if (config.storageDriver === "blob") {
    const key = `f/${randomUUID()}`;
    await put(key, data, { access: "private", addRandomSuffix: false, contentType: "application/octet-stream" });
    return key;
  }
  const key = randomUUID();
  if (config.storageDriver === "db") {
    await db.storedFile.create({ data: { key, data: new Uint8Array(data), sizeBytes: data.length } });
  } else {
    const target = diskPath(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
  }
  return key;
}

export async function saveFile(file: File): Promise<string> {
  return saveBuffer(Buffer.from(await file.arrayBuffer()));
}

/** Size of a Blob file, or null when it does not exist. */
export async function blobSize(key: string): Promise<number | null> {
  if (!isBlobKey(key)) return null;
  const r = await get(key, { access: "private", useCache: false });
  if (!r || r.statusCode !== 200) return null;
  await r.stream.cancel().catch(() => undefined);
  return r.blob.size;
}

export async function readStoredFile(key: string): Promise<Buffer> {
  if (isBlobKey(key)) {
    const r = await get(key, { access: "private" });
    if (!r || r.statusCode !== 200) throw new Error("file not found in Blob storage");
    return streamToBuffer(r.stream);
  }
  if (config.legacyDriver === "db") {
    const row = await db.storedFile.findUniqueOrThrow({ where: { key: checkKey(key) } });
    return Buffer.from(row.data);
  }
  return readFile(diskPath(key));
}

/**
 * Body for a download response. Blob files are streamed (a large file never sits in the function's memory,
 * and streamed responses are not subject to Vercel's 4.5 MB payload limit); other stores return the bytes.
 */
export async function openStoredFile(key: string): Promise<{ body: ReadableStream<Uint8Array> | Uint8Array; size: number | null }> {
  if (isBlobKey(key)) {
    const r = await get(key, { access: "private" });
    if (!r || r.statusCode !== 200) throw new Error("file not found in Blob storage");
    return { body: r.stream, size: r.blob.size };
  }
  const data = await readStoredFile(key);
  return { body: new Uint8Array(data), size: data.length };
}

export async function deleteStoredFile(key: string): Promise<void> {
  if (isBlobKey(key)) await del(key);
  else if (config.legacyDriver === "db") await db.storedFile.deleteMany({ where: { key: checkKey(key) } });
  else await rm(diskPath(key), { force: true });
}

/**
 * Move files kept in Postgres (StoredFile) to Blob and point every reference at the new key, until `deadline`.
 * Returns how many moved and how many are left, so the admin page can be clicked again for the rest.
 */
export async function moveDbFilesToBlob(deadline: number): Promise<{ moved: number; left: number; bytes: number }> {
  let moved = 0;
  let bytes = 0;
  while (Date.now() < deadline) {
    const row = await db.storedFile.findFirst({ orderBy: { createdAt: "asc" } });
    if (!row) break;
    const key = `f/${randomUUID()}`;
    await put(key, Buffer.from(row.data), { access: "private", addRandomSuffix: false, contentType: "application/octet-stream" });
    await db.$transaction([
      db.material.updateMany({ where: { storageKey: row.key }, data: { storageKey: key } }),
      db.submissionFile.updateMany({ where: { storageKey: row.key }, data: { storageKey: key } }),
      db.department.updateMany({ where: { logoKey: row.key }, data: { logoKey: key } }),
      db.storedFile.delete({ where: { key: row.key } }),
    ]);
    moved++;
    bytes += row.sizeBytes;
  }
  return { moved, left: await db.storedFile.count(), bytes };
}
