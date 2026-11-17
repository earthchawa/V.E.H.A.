import { beforeEach, describe, expect, it, vi } from "vitest";

const blob = vi.hoisted(() => ({ head: vi.fn(), get: vi.fn() }));
vi.mock("@vercel/blob", async (orig) => ({ ...(await orig<typeof import("@vercel/blob")>()), head: blob.head, get: blob.get }));
vi.mock("./db", () => ({ db: {} }));

import { BlobNotFoundError } from "@vercel/blob";
import { blobSize } from "./storage";

const KEY = "u/abcdefghij1234/0b6f2c1e-1d2a-4c3b-9e8f-123456789abc";
const stream = (...parts: string[]) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      for (const p of parts) c.enqueue(new TextEncoder().encode(p));
      c.close();
    },
  });

describe("blobSize", () => {
  beforeEach(() => {
    blob.head.mockReset();
    blob.get.mockReset();
  });

  it("uses the size the store records", async () => {
    blob.head.mockResolvedValue({ size: 1234 });
    expect(await blobSize(KEY)).toBe(1234);
    expect(blob.get).not.toHaveBeenCalled();
  });

  it("is null for a missing file or a key that is not a Blob key", async () => {
    blob.head.mockRejectedValue(new BlobNotFoundError());
    expect(await blobSize(KEY)).toBeNull();
    expect(await blobSize("not-a-blob-key")).toBeNull();
  });

  it("counts the bytes when the download is compressed and has no Content-Length", async () => {
    blob.head.mockRejectedValue(new Error("head unavailable"));
    // A Thai .txt answer: 3 bytes per Thai character, so the count must be in bytes.
    blob.get.mockResolvedValue({ statusCode: 200, headers: new Headers({ "content-encoding": "br" }), stream: stream("คำตอบ ", "ภาษาไทย"), blob: { size: 0 } });
    expect(await blobSize(KEY)).toBe(Buffer.byteLength("คำตอบ ภาษาไทย"));
  });
});
