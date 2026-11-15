import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth-forms";
import { PageShell, cardCls } from "@/components/ui";
import { getSessionUser, safeReturnPath } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await getSessionUser();
  if (user) redirect(safeReturnPath(next));
  return (
    <PageShell title="Create an account" intro="A Carrus account lets you reserve vehicles and see your trips." narrow>
      <div className={`${cardCls} p-5`}><SignupForm next={next ? safeReturnPath(next, "") : ""} /></div>
    </PageShell>
  );
}
