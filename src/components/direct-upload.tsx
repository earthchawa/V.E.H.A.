"use client";

import { createContext, useContext } from "react";
import { upload, uploadPresigned } from "@vercel/blob/client";

/**
 * Set in the app shell: whether files go straight from the browser to Blob storage, under which prefix, and
 * whether the store uses OIDC (presigned URLs) rather than a read-write token (client tokens).
 */
export type UploadConfig = { direct: boolean; prefix: string; presigned?: boolean };
const UploadContext = createContext<UploadConfig>({ direct: false, prefix: "" });
export function UploadProvider({ value, children }: { value: UploadConfig; children: React.ReactNode }) {
  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>;
}
export const useUploadConfig = () => useContext(UploadContext);

/** Must match BLOB_REF / BlobRef in lib/uploads.ts (the server side of this). */
const BLOB_REF = "blobref:";

/**
 * Replace every non-empty file in the form data by a reference to a direct upload. Returns the new form
 * data; throws if an upload fails. `onProgress` gets 0–100 over all files.
 */
export async function uploadFormFiles(fd: FormData, cfg: UploadConfig, onProgress?: (percent: number) => void): Promise<FormData> {
  const files = [...fd.entries()].filter((e): e is [string, File] => e[1] instanceof File && e[1].size > 0);
  if (!cfg.direct || files.length === 0) return fd;
  const total = files.reduce((n, [, f]) => n + f.size, 0);
  const done = new Map<File, number>();
  const out = new FormData();
  for (const [name, value] of fd.entries()) {
    if (!(value instanceof File)) out.append(name, value);
    else if (value.size > 0) {
      const key = `${cfg.prefix}${crypto.randomUUID()}`;
      const send = cfg.presigned ? uploadPresigned : upload;
      await send(key, value, {
        access: "private",
        handleUploadUrl: "/api/blob/upload",
        contentType: value.type || "application/octet-stream",
        multipart: value.size > 8 * 1024 * 1024,
        onUploadProgress: (e) => {
          done.set(value, e.loaded);
          onProgress?.(Math.round(([...done.values()].reduce((n, x) => n + x, 0) / total) * 100));
        },
      });
      out.append(name, BLOB_REF + JSON.stringify({ key, name: value.name, type: value.type, size: value.size }));
    }
  }
  return out;
}
