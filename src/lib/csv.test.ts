import { describe, expect, it } from "vitest";
import { parseCsv, parseUserImport, toCsv } from "./csv";

describe("parseCsv", () => {
  it("handles quotes, commas, CRLF and BOM", () => {
    expect(parseCsv('﻿a,"b, c","d ""q"""\r\n1,2,3\r\n')).toEqual([
      ["a", "b, c", 'd "q"'],
      ["1", "2", "3"],
    ]);
  });
  it("round-trips through toCsv", () => {
    const rows = [["x", 'y,"z"', "ไทย"]];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe("parseUserImport", () => {
  it("skips the header and maps Thai/English roles", () => {
    const { rows, errors } = parseUserImport(
      "username,fullName,role,email\n6601001,นนอ.ก ข,student,A@X.AC.TH\nT01,อ.ค,อาจารย์,\n",
    );
    expect(errors).toEqual([]);
    expect(rows).toMatchObject([
      { username: "6601001", role: "STUDENT", email: "a@x.ac.th" },
      { username: "T01", role: "INSTRUCTOR", email: null },
    ]);
  });
  it("does not treat a username that starts with 'id' as a header", () => {
    expect(parseUserImport("id001,Someone").rows).toHaveLength(1);
  });
  it("defaults role to student and reports bad rows", () => {
    const { rows, errors } = parseUserImport("6601001,A\nbad id,B\n6601001,C\n6601002,D,wizard\n6601003,E,,not-an-email");
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe("STUDENT");
    expect(errors).toHaveLength(4);
  });

  it("skips a byte-order mark and reads an optional starting password", () => {
    const { rows, errors } = parseUserImport("\uFEFFusername,fullName,role,email,department,password\nsomchai_k,น.อ.สมชาย ตัวอย่าง,instructor,,CS,start-pass-1\nx_y,X Y,instructor,,,\n");
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ username: "somchai_k", role: "INSTRUCTOR", department: "CS", password: "start-pass-1" });
    expect(rows[1].password).toBeNull();
    expect(parseUserImport("a_b,A B,instructor,,,abc").errors[0].key).toBe("csv.badPassword");
  });
});

describe("year level column", () => {
  it("reads the optional 7th column for cadets", () => {
    const { rows, errors } = parseUserImport("9001,Cadet A,cadet,,CS,,3\n9002,Cadet B,,,,,ชั้นปีที่ 2\n9003,Cadet C");
    expect(errors).toEqual([]);
    expect(rows.map((r) => r.yearLevel)).toEqual([3, 2, null]);
  });
  it("rejects a bad year, and a year on a staff account", () => {
    expect(parseUserImport("9001,Cadet A,cadet,,,,7").errors[0].key).toBe("csv.badYear");
    expect(parseUserImport("t_a,Teacher A,instructor,,,,2").errors[0].key).toBe("csv.badYear");
  });
});
