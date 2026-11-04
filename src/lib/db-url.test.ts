import { describe, expect, it } from "vitest";
import { applyDatabaseEnv, resolveDatabaseEnv } from "./db-url";

const pg = (h: string) => `postgresql://u:p@${h}/db`;

describe("resolveDatabaseEnv", () => {
  it("prefers the standard names", () => {
    const r = resolveDatabaseEnv({ DATABASE_URL: pg("a"), POSTGRES_URL: pg("b"), DATABASE_URL_UNPOOLED: pg("c") });
    expect([r.urlFrom, r.directFrom]).toEqual(["DATABASE_URL", "DATABASE_URL_UNPOOLED"]);
  });
  it("finds prefixed and POSTGRES_* names", () => {
    expect(resolveDatabaseEnv({ STORAGE_DATABASE_URL: pg("a"), STORAGE_DATABASE_URL_UNPOOLED: pg("b") })).toMatchObject({
      urlFrom: "STORAGE_DATABASE_URL",
      directFrom: "STORAGE_DATABASE_URL_UNPOOLED",
    });
    expect(resolveDatabaseEnv({ POSTGRES_PRISMA_URL: pg("a"), POSTGRES_URL_NON_POOLING: pg("b") })).toMatchObject({
      urlFrom: "POSTGRES_PRISMA_URL",
      directFrom: "POSTGRES_URL_NON_POOLING",
    });
  });
  it("ignores empty or non-Postgres values and lists names only", () => {
    const r = resolveDatabaseEnv({ DATABASE_URL: "", PGHOST: "h", OTHER: "x" });
    expect(r.url).toBeUndefined();
    expect(r.candidates).toEqual(["DATABASE_URL", "PGHOST"]);
  });
  it("applyDatabaseEnv fills DATABASE_URL", () => {
    const env: Record<string, string | undefined> = { STORAGE_POSTGRES_URL: pg("x") };
    applyDatabaseEnv(env);
    expect(env.DATABASE_URL).toBe(pg("x"));
  });
});
