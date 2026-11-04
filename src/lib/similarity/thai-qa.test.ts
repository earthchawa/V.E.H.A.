import { describe, expect, it } from "vitest";
import { checkAll } from "./engine";
import { looksGarbled } from "./extract";

// A typical Thai question-and-answer homework.
const questions =
  "ข้อ 1 จงอธิบายความแตกต่างระหว่างอาร์เรย์และลิงก์ลิสต์ พร้อมยกตัวอย่างการใช้งาน\n" +
  "ข้อ 2 จงบอกข้อดีและข้อเสียของการค้นหาแบบไบนารี";
const textbook = "การค้นหาแบบไบนารีต้องใช้ข้อมูลที่เรียงลำดับแล้ว และแบ่งครึ่งช่วงข้อมูลทุกครั้งที่เปรียบเทียบ";
const shared = "ผมคิดว่าลิงก์ลิสต์เหมาะกับระบบจองตั๋วเครื่องบินของกองบินเพราะมีการยกเลิกและเพิ่มรายการผู้โดยสารตลอดทั้งวัน";
const own = [
  "อาร์เรย์เข้าถึงข้อมูลตามตำแหน่งได้ทันที ส่วนลิงก์ลิสต์ต้องไล่จากโหนดแรก เหมาะกับตารางเวรยามที่อ่านบ่อย",
  "ข้อมูลในอาร์เรย์อยู่ติดกันในหน่วยความจำ แต่ลิงก์ลิสต์กระจายอยู่และเชื่อมกันด้วยตัวชี้ ใช้กับคิวงานซ่อมบำรุงอากาศยาน",
  "ถ้าต้องการขยายขนาดบ่อยควรใช้ลิงก์ลิสต์ เช่นรายการอุปกรณ์ที่เบิกเพิ่มเข้ามาเรื่อย ๆ ในคลังพัสดุ",
];
const sub = (id: string, text: string) => ({ id, content: text, segments: [{ s: 0, e: text.length, kind: "text" as const }] });

const answers = [
  sub("a", `${questions}\nตอบ ${shared}\n${textbook}`),
  sub("b", `${questions}\nตอบ ${shared}\n${textbook} ข้อเสียคือต้องเรียงข้อมูลก่อน`),
  sub("c", `${questions}\nตอบ ${own[0]}\n${textbook}`),
  sub("d", `${questions}\nตอบ ${own[1]}`),
  sub("e", `${questions}\nตอบ ${own[2]}`),
];

describe("Thai Q&A homework", () => {
  it("without filters, the copied questions make everyone look similar", () => {
    const { similarity } = checkAll(answers);
    expect(similarity.get("d")).toBeGreaterThan(0.3);
  });

  it("ignoring the instructions and class-wide passages leaves only the real pair", () => {
    const { similarity, matches } = checkAll(answers, questions, { ignoreCommon: true });
    expect(similarity.get("a")).toBeGreaterThan(0.3);
    expect(similarity.get("b")).toBeGreaterThan(0.3);
    expect(similarity.get("d")).toBe(0);
    expect(similarity.get("e")).toBe(0);
    // The textbook sentence is in 3 of 5 answers, so it is not held against anyone.
    expect(similarity.get("c")).toBe(0);
    expect(matches.map((m) => [m.aId, m.bId])).toEqual([["a", "b"]]);
  });

  it("the common filter needs at least 4 submissions", () => {
    const { similarity } = checkAll(answers.slice(0, 3), questions, { ignoreCommon: true });
    expect(similarity.get("c")).toBeGreaterThan(0);
  });
});

describe("looksGarbled", () => {
  it("accepts normal Thai and English", () => {
    expect(looksGarbled("การค้นหาแบบไบนารีต้องใช้ข้อมูลที่เรียงลำดับแล้ว Binary search")).toBe(false);
  });
  it("rejects private-use glyphs from legacy Thai PDF fonts", () => {
    expect(looksGarbled("กรค้นหาแบบไบนาร")).toBe(true);
  });
  it("rejects Thai marks with no base consonant (reordered extraction)", () => {
    expect(looksGarbled("้่ี การ ้ ค นหา ั ่ ี ื")).toBe(true);
  });
  it("rejects replacement characters", () => {
    expect(looksGarbled("��� text")).toBe(true);
  });
});
