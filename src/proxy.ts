import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { SITE_COOKIE, siteAccessConfig, siteAccessRequired, validSiteCookie } from "@/lib/site-access";

// Refreshes the Supabase session cookie on each request. This is NOT the
// authorization layer: every protected page and action re-checks the user on
// the server (see src/lib/auth/session.ts) and the database enforces RLS.
export async function proxy(request: NextRequest) {
  if (siteAccessRequired()) {
    const config = siteAccessConfig();
    if (!config) return new NextResponse("Private site is not configured.", { status: 503 });
    const publicGateRoute = request.nextUrl.pathname === "/site-access" || (request.nextUrl.pathname === "/site-access/unlock" && request.method === "POST");
    if (!publicGateRoute && !validSiteCookie(request.cookies.get(SITE_COOKIE)?.value, config.sessionSecret)) {
      const url = new URL("/site-access", request.url);
      url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
      return NextResponse.redirect(url);
    }
  }
  let response = NextResponse.next({ request });
  const env = publicEnv();
  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|favicon.ico|carrus-logo.png).*)"],
};
