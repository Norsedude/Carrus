"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { grantGuestAccess } from "@/lib/guest-access";
import { RATE_LIMITED_MESSAGE, allowRequest } from "@/lib/rate-limit";
import { getNow } from "@/lib/clock";
import { createAdminClient } from "@/lib/supabase/server";
import { createExternalDemoOrder, confirmExternalDemoOrder } from "@/server/booking/external-demo";
import { guestUserId } from "@/server/booking/guest";
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
  // Guests skip sign-in: the guest checkout page asks only for an email.
  if (!user) redirect(`/external/checkout/new?${new URLSearchParams({ providerKey, listingId, location, pickup, return: ret, radius })}`);
  const validated = validateSearch({ location, pickup, return: ret, radius }, getNow());
  if (!validated.ok) redirect(searchUrl);
  const criteria = validated.criteria;
  let orderId: string | null;
  try {
    orderId = await createExternalDemoOrder(createAdminClient(), {
      userId: user.id, providerKey, listingId,
      query: { pickupAt: criteria.pickupAt, returnAt: criteria.returnAt, coordinates: criteria.coordinates, radiusMiles: criteria.radiusMiles, timeZone: criteria.timeZone },
    });
  } catch {
    redirect(`${searchUrl}&external=unavailable`);
  }
  if (!orderId) redirect(searchUrl);
  redirect(`/external/checkout/${orderId}`);
}

export type ExternalDemoState = {
  message?: string;
  fieldErrors: CardFieldErrors & Partial<Record<"contactName" | "contactPhone" | "terms" | "guestEmail", string>>;
  values: { contactName: string; contactPhone: string; cardExpiry: string; cardZip: string; guestEmail?: string };
};

const contactSchema = z.object({
  contactName: z.string().min(2, "Enter the driver's full name").max(80),
  contactPhone: z.string().regex(/^[0-9+() .-]{7,20}$/, "Enter a phone number"),
});

export async function confirmExternalDemoAction(_prev: ExternalDemoState, form: FormData): Promise<ExternalDemoState> {
  if (value(form, "guest") === "1") return guestExternalDemo(form);
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

const guestEmailSchema = z.email().max(254);

/** Guest demo checkout: validate, file under the email, create and confirm in one step. */
async function guestExternalDemo(form: FormData): Promise<ExternalDemoState> {
  const values = {
    contactName: value(form, "contactName"), contactPhone: value(form, "contactPhone"),
    cardExpiry: value(form, "cardExpiry"), cardZip: value(form, "cardZip"), guestEmail: value(form, "guestEmail"),
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
  if (!guestEmailSchema.safeParse(values.guestEmail).success) fieldErrors.guestEmail = "Enter the email for your confirmation";
  if (form.get("terms") !== "on") fieldErrors.terms = "Acknowledge that this is a demo checkout";
  if (Object.keys(fieldErrors).length) return { values, fieldErrors, message: "Fix the highlighted fields. No payment was made." };

  const validated = validateSearch(
    { location: value(form, "location"), pickup: value(form, "pickup"), return: value(form, "return"), radius: value(form, "radius") },
    getNow(),
  );
  if (!validated.ok) return { values, fieldErrors: {}, message: "These trip dates are no longer valid. Return to search for a fresh offer." };
  const { criteria } = validated;
  if (!(await allowRequest("guestCheckout"))) return { values, fieldErrors: {}, message: `${RATE_LIMITED_MESSAGE} No payment was made.` };
  const admin = createAdminClient();
  let orderId: string | null = null;
  let userId: string;
  try {
    userId = await guestUserId(admin, values.guestEmail, values.contactName);
    orderId = await createExternalDemoOrder(admin, {
      userId,
      providerKey: value(form, "providerKey"),
      listingId: value(form, "listingId"),
      query: { pickupAt: criteria.pickupAt, returnAt: criteria.returnAt, coordinates: criteria.coordinates, radiusMiles: criteria.radiusMiles, timeZone: criteria.timeZone },
    });
  } catch {
    return { values, fieldErrors: {}, message: "We could not start the demo checkout right now. No payment was made." };
  }
  if (!orderId) return { values, fieldErrors: {}, message: "The provider offer changed or could not be checked. Return to search for a fresh offer." };
  const result = await confirmExternalDemoOrder(admin, { orderId, userId, name: values.contactName, phone: values.contactPhone, cardNumber: card.number });
  if (result === "confirmed") {
    await grantGuestAccess("order", orderId);
    redirect(`/external/confirmation/${orderId}`);
  }
  const messages = {
    declined: "Your demo card was declined. No payment or provider reservation was made.",
    expired: "This demo quote expired. Return to search for a fresh offer.",
    changed: "The provider offer changed or could not be checked. Return to search for a fresh offer.",
    missing: "This demo quote could not be found.",
  };
  return { values, fieldErrors: {}, message: messages[result] };
}
