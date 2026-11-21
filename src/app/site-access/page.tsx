import type { Metadata } from "next";
import { Field, Notice, PageShell, btnPrimary, cardCls } from "@/components/ui";
import { safeSiteReturnPath } from "@/lib/site-access";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Private access", robots: { index: false, follow: false } };

export default async function SiteAccessPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  return (
    <PageShell title="Private Carrus preview" intro="Enter the shared site password to view this prototype." narrow>
      <div className={`${cardCls} space-y-5 p-6`}>
        {params.error === "password" && <Notice tone="error">That password was not accepted. Try again.</Notice>}
        {params.error === "config" && <Notice tone="error">Site access is not configured. Contact the site owner.</Notice>}
        <form action="/site-access/unlock" method="post" className="space-y-4">
          <input type="hidden" name="next" value={safeSiteReturnPath(params.next)} />
          <Field label="Site password" name="password" type="password" autoComplete="current-password" required />
          <button type="submit" className={btnPrimary}>Enter Carrus</button>
        </form>
        <p className="text-sm text-gray-600">Carrus accounts are separate. After entering the site password, sign in to use customer, partner, or admin features.</p>
      </div>
    </PageShell>
  );
}
