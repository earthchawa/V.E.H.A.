import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "./config";
import { db } from "./db";

/**
 * Uploaded files are stored under random keys; original names live only in the database.
 * Driver "disk" writes under UPLOAD_DIR (self-hosted); "db" keeps bytes in Postgres (Vercel).
 */
function checkKey(key: string): string {
  if (!/^[a-f0-9-]{36}$/.test(key)) throw new Error("invalid storage key");
  return key;
}

function diskPath(key: string): string {
  return path.join(path.resolve(config.uploadDir), key.slice(0, 2), checkKey(key));
}

export async function saveBuffer(data: Buffer): Promise<string> {
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

export async function readStoredFile(key: string): Promise<Buffer> {
  if (config.storageDriver === "db") {
    const row = await db.storedFile.findUniqueOrThrow({ where: { key: checkKey(key) } });
    return Buffer.from(row.data);
  }
  return readFile(diskPath(key));
}

export async function deleteStoredFile(key: string): Promise<void> {
  if (config.storageDriver === "db") await db.storedFile.deleteMany({ where: { key: checkKey(key) } });
  else await rm(diskPath(key), { force: true });
}
