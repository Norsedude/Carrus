import { NextRequest, NextResponse } from "next/server";
import { SITE_COOKIE, issueSiteCookie, safeSiteReturnPath, siteAccessConfig, verifySitePassword, SESSION_SECONDS } from "@/lib/site-access";

export async function POST(request: NextRequest) {
  const config = siteAccessConfig();
  if (!config) return new NextResponse("Private site is not configured.", { status: 503 });
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let originHost = "";
  try { originHost = origin ? new URL(origin).host : ""; } catch { /* invalid origin */ }
  if (!originHost || !host || originHost !== host) return new NextResponse("Invalid request origin.", { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > 4096) return new NextResponse("Request too large.", { status: 413 });
  if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) return new NextResponse("Invalid form encoding.", { status: 415 });
  let form: FormData;
  try { form = await request.formData(); } catch { return new NextResponse("Invalid form.", { status: 400 }); }
  const next = safeSiteReturnPath(String(form.get("next") ?? ""));
  const password = String(form.get("password") ?? "");
  if (!verifySitePassword(password, config.passwordHash)) {
    const url = new URL("/site-access", request.url);
    url.searchParams.set("error", "password");
    url.searchParams.set("next", next);
    return NextResponse.redirect(url, { status: 303 });
  }
  const response = NextResponse.redirect(new URL(next, request.url), { status: 303 });
  response.cookies.set(SITE_COOKIE, issueSiteCookie(config.sessionSecret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
  return response;
}
