import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth-forms";
import { PageShell, cardCls } from "@/components/ui";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <PageShell title="Reset your password" intro="Enter your account email and we will send a link to choose a new password." narrow>
      <div className={`${cardCls} p-5`}><ForgotPasswordForm /></div>
    </PageShell>
  );
}
