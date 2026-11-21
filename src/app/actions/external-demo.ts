"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { getNow } from "@/lib/clock";
import { createAdminClient } from "@/lib/supabase/server";
import { createExternalDemoOrder, confirmExternalDemoOrder } from "@/server/booking/external-demo";
import { validateCard, type CardFieldErrors } from "@/server/payments/simulated";
import { validateSearch } from "@/server/search/validator";

const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function startExternalDemoAction(form: FormData) {
  const providerKey = value(form, "providerKey");
  const listingId = value(form, "listingId");
  const location = value(form, "location");
  const pickup = value(form, "pickup");
  const ret = value(form, "return");
  const radius = value(form, "radius");
  const searchUrl = `/search?${new URLSearchParams({ location, pickup, return: ret, ...(radius ? { radius } : {}) })}`;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(searchUrl)}`);
  const validated = validateSearch({ location, pickup, return: ret, radius }, getNow());
  if (!validated.ok) redirect(searchUrl);
  const criteria = validated.criteria;
  let orderId: string | null;
  try {
    orderId = await createExternalDemoOrder(createAdminClient(), {
      userId: user.id, providerKey, listingId,
      query: { pickupAt: criteria.pickupAt, returnAt: criteria.returnAt, coordinates: criteria.coordinates, radiusMiles: criteria.radiusMiles },
    });
  } catch {
    redirect(`${searchUrl}&external=unavailable`);
  }
  if (!orderId) redirect(searchUrl);
  redirect(`/external/checkout/${orderId}`);
}

export type ExternalDemoState = {
  message?: string;
  fieldErrors: CardFieldErrors & Partial<Record<"contactName" | "contactPhone" | "terms", string>>;
  values: { contactName: string; contactPhone: string; cardExpiry: string; cardZip: string };
};

const contactSchema = z.object({
  contactName: z.string().min(2, "Enter the driver's full name").max(80),
  contactPhone: z.string().regex(/^[0-9+() .-]{7,20}$/, "Enter a phone number"),
});

export async function confirmExternalDemoAction(_prev: ExternalDemoState, form: FormData): Promise<ExternalDemoState> {
  const orderId = value(form, "orderId");
  if (!uuid.test(orderId)) redirect("/search");
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/external/checkout/${orderId}`)}`);
  const values = {
    contactName: value(form, "contactName"), contactPhone: value(form, "contactPhone"),
    cardExpiry: value(form, "cardExpiry"), cardZip: value(form, "cardZip"),
  };
  const card = { number: value(form, "cardNumber"), expiry: values.cardExpiry, cvc: value(form, "cardCvc"), zip: values.cardZip };
  const fieldErrors: ExternalDemoState["fieldErrors"] = { ...validateCard(card, getNow()) };
  const contact = contactSchema.safeParse(values);
  if (!contact.success) {
    for (const issue of contact.error.issues) {
      const key = issue.path[0] as "contactName" | "contactPhone";
      fieldErrors[key] ??= issue.message;
    }
  }
  if (form.get("terms") !== "on") fieldErrors.terms = "Acknowledge that this is a demo checkout";
  if (Object.keys(fieldErrors).length) return { values, fieldErrors, message: "Fix the highlighted fields. No payment was made." };

  const result = await confirmExternalDemoOrder(createAdminClient(), {
    orderId, userId: user.id, name: values.contactName, phone: values.contactPhone, cardNumber: card.number,
  });
  if (result === "confirmed") redirect(`/external/confirmation/${orderId}`);
  const messages = {
    declined: "Your demo card was declined. No payment or provider reservation was made.",
    expired: "This demo quote expired. Return to search for a fresh offer.",
    changed: "The provider offer changed or could not be checked. Return to search for a fresh offer.",
    missing: "This demo quote could not be found.",
  };
  return { values, fieldErrors: {}, message: messages[result] };
}
