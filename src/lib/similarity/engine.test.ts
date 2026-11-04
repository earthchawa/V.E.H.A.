import { describe, expect, it } from "vitest";
import { checkAll, level } from "./engine";
import { assembleContent } from "./content";
import { extractNotebook } from "./extract";
import { tokenizeCode, tokenizeText } from "./tokenize";

const sub = (id: string, text: string, kind: "text" | "code" = "text") => ({
  id,
  content: text,
  segments: [{ s: 0, e: text.length, kind }],
});

const thaiA =
  "โครงสร้างข้อมูลแบบลิงก์ลิสต์ประกอบด้วยโหนดที่เชื่อมต่อกันด้วยตัวชี้ แต่ละโหนดเก็บข้อมูลและที่อยู่ของโหนดถัดไป " +
  "ข้อดีคือสามารถเพิ่มและลบข้อมูลได้รวดเร็วโดยไม่ต้องเลื่อนสมาชิกตัวอื่น";
const thaiCopy = "บทนำ: " + thaiA.replace("รวดเร็ว", "อย่างรวดเร็ว") + " สรุปได้ว่าเหมาะกับงานที่มีการแก้ไขบ่อย";
const thaiOther =
  "ฐานข้อมูลเชิงสัมพันธ์จัดเก็บข้อมูลในรูปแบบตาราง มีคีย์หลักเพื่อระบุแถวแต่ละแถว และใช้ภาษาเอสคิวแอลในการสืบค้นข้อมูล";

describe("tokenizers", () => {
  it("segments Thai words and drops punctuation", () => {
    expect(tokenizeText("การเขียนโปรแกรม, Hello!").map((t) => t.v)).toEqual(["การ", "เขียน", "โปรแกรม", "hello"]);
  });
  it("keeps character offsets", () => {
    const [, b] = tokenizeText("ab cd", 10);
    expect([b.s, b.e]).toEqual([13, 15]);
  });
  it("normalises identifiers and drops comments in code", () => {
    const a = tokenizeCode("total = 0  # sum\nfor x in items:\n    total += x").map((t) => t.v);
    const b = tokenizeCode("s = 0\nfor value in data:  // loop\n    s += value").map((t) => t.v);
    expect(a).toEqual(b);
  });
});

describe("checkAll", () => {
  it("flags copied Thai prose but not unrelated text", () => {
    const { similarity, matches } = checkAll([sub("a", thaiA), sub("b", thaiCopy), sub("c", thaiOther)]);
    expect(similarity.get("a")).toBeGreaterThan(0.8);
    expect(similarity.get("b")).toBeGreaterThan(0.5);
    expect(similarity.get("c")).toBe(0);
    expect(matches).toHaveLength(1);
    const [[s, e]] = matches[0].spansB;
    expect(thaiCopy.slice(s, e)).toContain("โครงสร้างข้อมูล");
  });

  it("catches code with renamed variables", () => {
    const code1 = `class Node:\n    def __init__(self, data):\n        self.data = data\n        self.next = None\n\ndef push(head, value):\n    node = Node(value)\n    node.next = head\n    return node\n`;
    const code2 = `# my own work\nclass Item:\n    def __init__(self, v):\n        self.v = v\n        self.link = None\n\ndef add_front(first, x):\n    n = Item(x)\n    n.link = first\n    return n\n`;
    const { similarity } = checkAll([sub("a", code1, "code"), sub("b", code2, "code")]);
    expect(similarity.get("a")).toBeGreaterThan(0.9);
  });

  it("ignores instructor starter text", () => {
    const base = thaiA;
    const { similarity } = checkAll([sub("a", thaiA), sub("b", thaiCopy)], base);
    expect(similarity.get("a")).toBe(0);
  });

  it("does not compare prose against code", () => {
    const text = "for x in range ten print x " .repeat(10);
    const { matches } = checkAll([sub("a", text, "text"), sub("b", text, "code")]);
    expect(matches).toHaveLength(0);
  });
});

describe("assembleContent / notebooks", () => {
  it("lays out answer + files with meta headers and correct ranges", () => {
    const { content, segments } = assembleContent("my answer", [
      { fileName: "a.py", extracted: [{ text: "print(1)", kind: "code" }] },
      { fileName: "x.bin", extracted: null },
    ]);
    expect(content).toBe("my answer\n\n▌ a.py\nprint(1)");
    expect(segments.map((s) => [content.slice(s.s, s.e), s.kind])).toEqual([
      ["my answer", "text"],
      ["\n\n▌ a.py\n", "meta"],
      ["print(1)", "code"],
    ]);
  });
  it("splits notebook cells by type", () => {
    const nb = JSON.stringify({
      cells: [
        { cell_type: "markdown", source: ["# Lab 1"] },
        { cell_type: "code", source: "x = 1" },
        { cell_type: "code", source: ["y = 2"] },
      ],
    });
    expect(extractNotebook(nb)).toEqual([
      { text: "# Lab 1", kind: "text" },
      { text: "x = 1\n\ny = 2", kind: "code" },
    ]);
  });
  it("maps scores to levels", () => {
    expect([level(0.05), level(0.2), level(0.6)]).toEqual(["low", "medium", "high"]);
  });
});
