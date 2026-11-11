import { describe, expect, it } from "vitest";
import { AI_ANSWER_VARIANTS, VARIANT_STYLES, buildPrompt } from "./ai-answers";

describe("AI answer prompt", () => {
  it("carries the title and instructions, and the starter only when there is one", () => {
    const p = buildPrompt("Lab 3", "  Implement a linked list.  ", null);
    expect(p).toBe("Assignment: Lab 3\n\nImplement a linked list.");
    expect(buildPrompt("Lab 3", "Do it", "class Node: pass")).toContain("Starter text / code given with the assignment:\nclass Node: pass");
    expect(buildPrompt("Lab 3", "Do it", "   ")).not.toContain("Starter");
  });
  it("has a style for every variant asked for", () => {
    expect(VARIANT_STYLES.length).toBeGreaterThanOrEqual(AI_ANSWER_VARIANTS);
  });
});
