import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";

export const SITE_COOKIE = "carrus_site_access";
export const SESSION_SECONDS = 7 * 24 * 60 * 60;

type SiteAccessConfig = { passwordHash: string; sessionSecret: string };

/** A production deployment without both secrets stays closed. */
export function siteAccessConfig(): SiteAccessConfig | null {
  const passwordHash = process.env.SITE_ACCESS_PASSWORD_HASH;
  const sessionSecret = process.env.SITE_ACCESS_SESSION_SECRET;
  if (!passwordHash || !sessionSecret) return null;
  if (!/^[0-9a-f]{32}:[0-9a-f]{128}$/i.test(passwordHash) || sessionSecret.length < 43) return null;
  return { passwordHash, sessionSecret };
}

export function siteAccessRequired(): boolean {
  return process.env.NODE_ENV === "production" || process.env.APP_ENV === "production" || process.env.SITE_ACCESS_ENABLED === "true";
}

export function verifySitePassword(password: string, stored: string): boolean {
  if (password.length > 1024 || !/^[0-9a-f]{32}:[0-9a-f]{128}$/i.test(stored)) return false;
  const [salt, expected] = stored.split(":");
  const actual = scryptSync(password, Buffer.from(salt, "hex"), 64);
  return timingSafeEqual(actual, Buffer.from(expected, "hex"));
}

function signature(expires: string, secret: string): string {
  return createHmac("sha256", secret).update(`carrus-site-access:${expires}`).digest("base64url");
}

export function issueSiteCookie(secret: string, now = Date.now()): string {
  const expires = String(Math.floor(now / 1000) + SESSION_SECONDS);
  return `${expires}.${signature(expires, secret)}`;
}

export function validSiteCookie(cookie: string | undefined, secret: string, now = Date.now()): boolean {
  if (!cookie) return false;
  const [expires, supplied, extra] = cookie.split(".");
  if (extra || !expires || !/^[0-9]{10,12}$/.test(expires) || !supplied || !/^[A-Za-z0-9_-]{43}$/.test(supplied)) return false;
  const seconds = Number(expires);
  if (seconds <= Math.floor(now / 1000) || seconds > Math.floor(now / 1000) + SESSION_SECONDS) return false;
  const expected = Buffer.from(signature(expires, secret));
  return timingSafeEqual(expected, Buffer.from(supplied));
}

export function safeSiteReturnPath(path: string | null | undefined): string {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\") || path.startsWith("/site-access")) return "/";
  return path;
}
