import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { markNotificationsReadAction } from "@/app/actions/account";
import { PageShell, btnSecondary, cardCls } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { expirePendingRequests } from "@/server/booking/requests";

export const metadata: Metadata = { title: "Inbox" };

export default async function InboxPage() {
  const user = await requireUser("/inbox");
  await expirePendingRequests();
  const db = await createClient();
  const { data } = await db
    .from("notifications")
    .select("id, kind, title, body, link, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const items = data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <PageShell title="Inbox" intro={unread ? `${unread} unread` : "You are all caught up."}>
      {items.length === 0 ? (
        <div className={`${cardCls} flex flex-col items-center p-10 text-center`}>
          <Bell className="size-8 text-gray-400" aria-hidden />
          <p className="mt-3 text-gray-600">Booking updates and host replies will show up here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {unread > 0 && (
            <form action={markNotificationsReadAction}>
              <button type="submit" className={btnSecondary}>Mark all as read</button>
            </form>
          )}
          <ul className="space-y-2" data-testid="inbox">
            {items.map((n) => (
              <li key={n.id} className={`${cardCls} flex gap-4 p-4 ${n.read_at ? "" : "border-accent/40 bg-accent-soft/40"}`} data-testid="notification" data-kind={n.kind}>
                <span aria-hidden className={`mt-2 size-2 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-accent"}`} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900">
                    {n.link ? <Link href={n.link} className="underline-offset-4 hover:underline">{n.title}</Link> : n.title}
                    {!n.read_at && <span className="sr-only"> (unread)</span>}
                  </p>
                  {n.body && <p className="mt-0.5 text-sm text-gray-600">{n.body}</p>}
                  <p className="mt-1 text-xs text-gray-400">{formatDateTime(n.created_at, "America/Los_Angeles")}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </PageShell>
  );
}
