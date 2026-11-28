"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

/** Partner approves or declines a request-to-book reservation. The database checks ownership. */
export async function respondToRequestAction(form: FormData) {
  const bookingId = text(form, "bookingId");
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) redirect("/partner");
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/partner/reservations/${bookingId}`)}`);
  const approve = text(form, "decision") === "approve";
  const reason = text(form, "reason").slice(0, 300);
  const db = await createClient();
  const { data, error } = await db.rpc("respond_to_booking", { _booking: bookingId, _approve: approve, _reason: reason || undefined });
  const status = error ? "error" : String((data as { status?: string } | null)?.status ?? "error");
  revalidatePath("/partner");
  revalidatePath(`/partner/reservations/${bookingId}`);
  redirect(`/partner/reservations/${bookingId}?result=${encodeURIComponent(status)}`);
}
