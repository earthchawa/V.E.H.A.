import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "./config";

/** Files are stored under random keys; the original name lives only in the database. */
function resolveKey(key: string): string {
  if (!/^[a-f0-9-]{36}$/.test(key)) throw new Error("invalid storage key");
  return path.join(path.resolve(config.uploadDir), key.slice(0, 2), key);
}

export async function saveFile(file: File): Promise<string> {
  const key = randomUUID();
  const target = resolveKey(key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await file.arrayBuffer()));
  return key;
}

export function readStoredFile(key: string): Promise<Buffer> {
  return readFile(resolveKey(key));
}

export async function deleteStoredFile(key: string): Promise<void> {
  await rm(resolveKey(key), { force: true });
}
