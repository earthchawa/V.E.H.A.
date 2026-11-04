import { describe, expect, it } from "vitest";
import { afterFailedLogin, loginBlock } from "./lockout";

const now = new Date("2026-11-04T10:00:00Z");
const later = new Date(now.getTime() + 60_000);
const earlier = new Date(now.getTime() - 60_000);

describe("loginBlock", () => {
  it("allows a normal account", () => {
    expect(loginBlock({ lockedUntil: null, mustChangePassword: false, tempPasswordExpiresAt: null }, now)).toBeNull();
  });
  it("blocks while locked and frees after", () => {
    expect(loginBlock({ lockedUntil: later, mustChangePassword: false, tempPasswordExpiresAt: null }, now)).toBe("locked");
    expect(loginBlock({ lockedUntil: earlier, mustChangePassword: false, tempPasswordExpiresAt: null }, now)).toBeNull();
  });
  it("blocks an expired temporary password but not a changed one", () => {
    expect(loginBlock({ lockedUntil: null, mustChangePassword: true, tempPasswordExpiresAt: earlier }, now)).toBe("temp-expired");
    expect(loginBlock({ lockedUntil: null, mustChangePassword: false, tempPasswordExpiresAt: earlier }, now)).toBeNull();
  });
});

describe("afterFailedLogin", () => {
  it("counts up then locks on the 5th failure", () => {
    expect(afterFailedLogin(0, now, 5, 15)).toEqual({ failedLoginCount: 1, lockedUntil: null });
    const locked = afterFailedLogin(4, now, 5, 15);
    expect(locked.failedLoginCount).toBe(0);
    expect(locked.lockedUntil?.getTime()).toBe(now.getTime() + 15 * 60_000);
  });
});
