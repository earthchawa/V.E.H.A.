import { describe, expect, it } from "vitest";
import { codeArea, normaliseCourseCode, parseSchedule } from "./schedule-import";

describe("parseSchedule", () => {
  it("reads rows, skips the header and normalises codes", () => {
    const { rows, errors } = parseSchedule(
      "year,semester,code,title_th,title_en,credits,section,instructors\n" +
        '2569,1,คต 231,,,,,wichai_p\n' +
        '2569,2,cs 132,การโปรแกรมคอมพิวเตอร์เบื้องต้น,Introduction to Computer Programming,3,1,"somchai_k, malee_s;anan_t"\n',
    );
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ academicYear: 2569, semester: 2, code: "CS132", credits: 3, section: "1", instructors: ["somchai_k", "malee_s", "anan_t"] });
  });

  it("maps Thai prefixes and rejects unknown ones", () => {
    expect(parseSchedule("2569,1,คต 231,,,,,x_user").rows[0].code).toBe("CS231");
    expect(parseSchedule("2569,1,คณ 111,,,,,x_user").rows[0].code).toBe("MA111");
    expect(parseSchedule("2569,1,สศ 405,,,,,x_user").rows[0].code).toBe("SS405");
    expect(parseSchedule("2569,1,ศส402,,,,,x_user").rows[0].code).toBe("SS402");
    expect(parseSchedule("2569,1,มศ 101,,,,,x_user").errors[0].key).toBe("sched.badCode");
  });

  it("reports bad years, semesters, users and duplicates by line", () => {
    const { errors } = parseSchedule("69,1,CS231,,,,,abc\n2569,4,CS231,,,,,abc\n2569,1,CS231,,,,,a\n2569,1,CS231,,,,,abc\n2569,1,CS231,,,,,abc\n2569,1,CS232,,,,,");
    expect(errors.map((e) => e.key)).toEqual(["sched.badYear", "sched.badSemester", "sched.badUser", "sched.duplicate", "sched.noInstructor"]);
    expect(errors[3].vars?.line).toBe(5);
  });

  it("reads an optional cadets column", () => {
    const { rows } = parseSchedule('2569,1,CS231,,,,1,wichai_p,"7701 7702, 7703"');
    expect(rows[0].cadets).toEqual(["7701", "7702", "7703"]);
    expect(parseSchedule("2569,1,CS231,,,,1,wichai_p").rows[0].cadets).toEqual([]);
  });

  it("helpers", () => {
    expect(normaliseCourseCode(" ma 111 ")).toBe("MA111");
    expect(codeArea("CS530")).toBe("CS");
  });
});
