import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CURRICULUM, curriculumNote, parseCurriculumNote } from "./curriculum";

describe("curriculum", () => {
  it("has unique, well-formed codes in CS / MA", () => {
    const codes = CURRICULUM.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of CURRICULUM) {
      expect(c.code).toMatch(/^(CS|MA)\d{3}$/);
      expect(c.titleTh.trim()).not.toBe("");
      expect(c.hours).toMatch(/^\d-\d-\d$/);
    }
  });

  it("every course is in the migration that adds them to existing databases", () => {
    const dir = join(process.cwd(), "prisma", "migrations");
    const folder = readdirSync(dir).find((d) => d.endsWith("_curriculum_cs_ma"));
    expect(folder).toBeTruthy();
    const sql = readFileSync(join(dir, folder!, "migration.sql"), "utf8");
    for (const c of CURRICULUM) expect(sql).toContain(`'${c.code}', '${c.title.replace(/'/g, "''")}', '${c.titleTh}'`);
  });
});

describe("parseCurriculumNote", () => {
  it("reads back every generated note", () => {
    for (const c of CURRICULUM) expect(parseCurriculumNote(curriculumNote(c))).toEqual({ year: c.year, credits: c.credits, hours: c.hours });
  });
  it("leaves hand-written descriptions alone", () => {
    expect(parseCurriculumNote("Intro course for all cadets")).toBeNull();
    expect(parseCurriculumNote(null)).toBeNull();
  });
});
