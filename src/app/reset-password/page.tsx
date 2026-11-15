import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth-forms";
import { Notice, PageShell, btnPrimary, cardCls } from "@/components/ui";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <PageShell title="Choose a new password" narrow>
        <Notice tone="error" title="This reset link is not valid">It may have expired or already been used. Request a new link.</Notice>
        <Link href="/forgot-password" className={`${btnPrimary} mt-4`}>Request a new link</Link>
      </PageShell>
    );
  }
  return (
    <PageShell title="Choose a new password" intro={`For ${user.email}`} narrow>
      <div className={`${cardCls} p-5`}><ResetPasswordForm /></div>
    </PageShell>
  );
}
