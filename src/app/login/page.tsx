import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-forms";
import { Notice, PageShell, cardCls } from "@/components/ui";
import { getSessionUser, safeReturnPath } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const user = await getSessionUser();
  if (user) redirect(safeReturnPath(next));
  const safeNext = next ? safeReturnPath(next, "") : "";
  const rememberedEmail = (await cookies()).get("carrus_remember_email")?.value ?? "";
  return (
    <PageShell title={rememberedEmail ? "Welcome back" : "Sign in"} intro={rememberedEmail ? `Signing in as ${rememberedEmail}` : undefined} narrow>
      {safeNext && (
        <div className="mb-4"><Notice>Sign in to continue. Your selection is kept.</Notice></div>
      )}
      {error === "link" && (
        <div className="mb-4"><Notice tone="error">That link is invalid or has expired. Request a new one.</Notice></div>
      )}
      <div className={`${cardCls} p-6`}><LoginForm next={safeNext} rememberedEmail={rememberedEmail} /></div>
    </PageShell>
  );
}
