import { describe, expect, it } from "vitest";
import { checkPasswordPolicy, generateTempPassword, hashPassword, verifyPassword } from "./password";

describe("checkPasswordPolicy", () => {
  it("accepts a reasonable password", () => {
    expect(checkPasswordPolicy("blue7Sky42", "6601001")).toBeNull();
  });
  it("rejects short passwords", () => {
    expect(checkPasswordPolicy("ab1", "6601001")).toMatch(/อย่างน้อย/);
  });
  it("requires letters and digits", () => {
    expect(checkPasswordPolicy("abcdefghij", "x")).not.toBeNull();
    expect(checkPasswordPolicy("1234567890", "x")).not.toBeNull();
  });
  it("rejects passwords containing the username", () => {
    expect(checkPasswordPolicy("pw6601001x", "6601001")).toMatch(/รหัสประจำตัว/);
  });
  it("rejects passwords over bcrypt's 72-byte limit", () => {
    expect(checkPasswordPolicy("ก".repeat(30) + "a1", "x")).toMatch(/ยาวเกินไป/);
  });
});

describe("generateTempPassword", () => {
  it("always satisfies the policy and avoids ambiguous characters", () => {
    for (let i = 0; i < 500; i++) {
      const p = generateTempPassword();
      expect(p).toHaveLength(10);
      expect(checkPasswordPolicy(p, "zzzzzz")).toBeNull();
      expect(p).not.toMatch(/[0O1lI]/);
    }
  });
});

describe("hashPassword", () => {
  it("round-trips", async () => {
    const h = await hashPassword("blue7Sky42");
    expect(await verifyPassword("blue7Sky42", h)).toBe(true);
    expect(await verifyPassword("blue7Sky43", h)).toBe(false);
  });
});
