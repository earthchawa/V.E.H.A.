import { describe, expect, it } from "vitest";
import { isBlobKey, isUserUploadKey, userUploadPrefix } from "./storage";
import { BLOB_REF, parseBlobRef } from "./uploads";

const UUID = "0b9d2c1e-5a4f-4c3b-9e8d-7f6a5b4c3d2e";
const ME = "cmw1m28df000aqh6qmv2mud2z";
const OTHER = "cmw1m28df000bqh6q0000aaaa";

describe("storage keys", () => {
  it("tells Blob keys from legacy keys", () => {
    expect(isBlobKey(`f/${UUID}`)).toBe(true);
    expect(isBlobKey(`u/${ME}/${UUID}`)).toBe(true);
    expect(isBlobKey(UUID)).toBe(false);
    expect(isBlobKey(`u/${ME}/../${UUID}`)).toBe(false);
    expect(isBlobKey(`x/${UUID}`)).toBe(false);
    expect(isBlobKey(`f/${UUID}/extra`)).toBe(false);
  });
  it("accepts a browser upload only under the user's own prefix", () => {
    expect(userUploadPrefix(ME)).toBe(`u/${ME}/`);
    expect(isUserUploadKey(`u/${ME}/${UUID}`, ME)).toBe(true);
    expect(isUserUploadKey(`u/${OTHER}/${UUID}`, ME)).toBe(false);
    expect(isUserUploadKey(`f/${UUID}`, ME)).toBe(false);
    expect(isUserUploadKey(`u/${ME}/not-a-uuid`, ME)).toBe(false);
  });
});

describe("parseBlobRef", () => {
  it("reads a reference posted in place of a file", () => {
    const ref = parseBlobRef(BLOB_REF + JSON.stringify({ key: `u/${ME}/${UUID}`, name: "รายงาน.pdf", type: "application/pdf", size: 12 }));
    expect(ref).toEqual({ key: `u/${ME}/${UUID}`, name: "รายงาน.pdf", type: "application/pdf", size: 12 });
  });
  it("ignores anything else", () => {
    expect(parseBlobRef("hello")).toBeNull();
    expect(parseBlobRef(BLOB_REF + "{not json")).toBeNull();
    expect(parseBlobRef(BLOB_REF + JSON.stringify({ name: "x" }))).toBeNull();
  });
});
