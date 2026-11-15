import { NextResponse, type NextRequest } from "next/server";
import { safeReturnPath } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// Completes email links (account confirmation and password reset) by
// exchanging the one-time code for a session cookie, then redirects to a
// same-site path only.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeReturnPath(url.searchParams.get("next"), "/account");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
