import { describe, expect, it } from "vitest";
import { buildWebDocument, cleanFiles, cleanTraceback, isBlankCode } from "./code";
import { autoGrade } from "./quiz";

describe("code questions", () => {
  it("keeps only the language's files", () => {
    expect(cleanFiles("python", { "main.py": "print(1)", "evil.sh": "rm" })).toEqual({ "main.py": "print(1)" });
    expect(cleanFiles("web", { "index.html": 5 })).toEqual({ "index.html": "", "style.css": "", "script.js": "" });
    expect(cleanFiles("python", { "main.py": "x".repeat(60_000) })["main.py"]).toHaveLength(50_000);
  });

  it("blank code scores 0, anything else is graded by hand", () => {
    const q = { type: "CODE" as const, points: 5, options: [], accepted: [] };
    expect(autoGrade(q, { files: { "main.py": "  \n" } })).toBe(0);
    expect(autoGrade(q, null)).toBe(0);
    expect(autoGrade(q, { files: { "main.py": "print(1)" } })).toBeNull();
    expect(isBlankCode({ a: "", b: " " })).toBe(true);
  });

  it("maps script.js errors back to their own line numbers", () => {
    const { html, jsLine } = buildWebDocument({ "index.html": "<p>x</p>\n<p>y</p>", "style.css": "a{}", "script.js": "one()\ntwo()" }, "tok");
    const lines = html.split("\n");
    expect(lines[jsLine - 1]).toBe("one()");
    expect(lines[jsLine]).toBe("two()");
  });

  it("does not let script.js close its own script tag", () => {
    const { html } = buildWebDocument({ "script.js": 'console.log("</script><b>")' }, "t");
    expect(html).toContain("<\\/script><b>");
  });

  it("hides Pyodide's internal frames in tracebacks", () => {
    const tb = [
      "Traceback (most recent call last):",
      '  File "/lib/python312.zip/_pyodide/_base.py", line 597, in eval_code',
      "    return self.run(globals, locals)",
      '  File "main.py", line 2, in <module>',
      "    print(1/0)",
      "ZeroDivisionError: division by zero",
    ].join("\n");
    expect(cleanTraceback(tb)).toBe(['Traceback (most recent call last):', '  File "main.py", line 2, in <module>', "    print(1/0)", "ZeroDivisionError: division by zero"].join("\n"));
  });
});
