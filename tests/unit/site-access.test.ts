import { scryptSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { issueSiteCookie, safeSiteReturnPath, validSiteCookie, verifySitePassword } from "@/lib/site-access";

const salt = "0123456789abcdef0123456789abcdef";
const hash = `${salt}:${scryptSync("correct horse battery staple", Buffer.from(salt, "hex"), 64).toString("hex")}`;
const secret = "a-long-random-session-secret-that-is-at-least-forty-three-characters";

describe("private site access", () => {
  it("verifies the stored password hash without accepting a wrong password", () => {
    expect(verifySitePassword("correct horse battery staple", hash)).toBe(true);
    expect(verifySitePassword("wrong", hash)).toBe(false);
  });

  it("accepts only unexpired, untampered session cookies", () => {
    const now = Date.UTC(2026, 10, 21);
    const cookie = issueSiteCookie(secret, now);
    expect(validSiteCookie(cookie, secret, now)).toBe(true);
    expect(validSiteCookie(cookie, "wrong-secret", now)).toBe(false);
    expect(validSiteCookie(cookie.replace(/.$/, "x"), secret, now)).toBe(false);
    expect(validSiteCookie(cookie, secret, now + 8 * 24 * 60 * 60 * 1000)).toBe(false);
  });

  it("only returns same-site paths after unlock", () => {
    expect(safeSiteReturnPath("/search?location=SJC")).toBe("/search?location=SJC");
    expect(safeSiteReturnPath("//outside.example")).toBe("/");
    expect(safeSiteReturnPath("/site-access?next=/admin")).toBe("/");
  });
});
