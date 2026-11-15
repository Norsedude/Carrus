"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { getNow } from "@/lib/clock";
import { createAdminClient } from "@/lib/supabase/server";
import { createQuote, submitCheckout } from "@/server/booking/service";
import { validateCard, type CardFieldErrors } from "@/server/payments/simulated";
import { validateDates } from "@/server/search/validator";
import { getVehicleRow } from "@/server/vehicles/repository";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

/**
 * "Reserve" from a vehicle or compare page: creates a server-priced quote and
 * moves to preconfirmation. Creates no booking and takes no hold.
 */
export async function startBookingAction(form: FormData) {
  const vehicleId = text(form, "vehicleId");
  const pickup = text(form, "pickup");
  const ret = text(form, "return");
  const location = text(form, "location");
  const back = text(form, "back");
  const backPath = back.startsWith("/compare") || back.startsWith("/vehicles/") ? back : `/vehicles/${vehicleId}`;
  const withFlag = (flag: string) => `${backPath}${backPath.includes("?") ? "&" : "?"}${flag}`;

  const admin = createAdminClient();
  const row = await getVehicleRow(admin, vehicleId);
  if (!row) redirect("/");
  const dates = validateDates(pickup, ret, row.time_zone, getNow());
  if (!dates.ok) redirect(withFlag("problem=dates"));

  const user = await getSessionUser();
  const quote = await createQuote(admin, {
    vehicleId,
    pickupAt: dates.pickupAt,
    returnAt: dates.returnAt,
    userId: user?.id ?? null,
  });
  if (!quote.ok) redirect(withFlag(`problem=unavailable&vehicle=${vehicleId}`));
  void location;
  redirect(`/booking/${quote.quoteId}`);
}

export type CheckoutState = {
  idempotencyKey: string;
  message?: string;
  tone?: "error" | "warning";
  fieldErrors: CardFieldErrors & Partial<Record<"contactName" | "contactPhone" | "terms", string>>;
  values: { contactName: string; contactPhone: string; cardExpiry: string; cardZip: string };
  blocked?: boolean;
};

const contactSchema = z.object({
  contactName: z.string().min(2, "Enter the driver's full name").max(80, "Name is too long"),
  contactPhone: z
    .string()
    .regex(/^[0-9+() .-]{7,20}$/, "Enter a phone number, for example 408-555-0101"),
});

/**
 * Checkout submit. The server re-reads the signed-in user and the stored
 * quote; the browser supplies no price, user id or payment status.
 */
export async function checkoutAction(prev: CheckoutState, form: FormData): Promise<CheckoutState> {
  const quoteId = text(form, "quoteId");
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/checkout/${quoteId}`)}`);

  const values = {
    contactName: text(form, "contactName"),
    contactPhone: text(form, "contactPhone"),
    cardExpiry: text(form, "cardExpiry"),
    cardZip: text(form, "cardZip"),
  };
  const card = { number: text(form, "cardNumber"), expiry: values.cardExpiry, cvc: text(form, "cardCvc"), zip: values.cardZip };
  // Validation failures never reach the booking tables, so the key is reused.
  const idempotencyKey = text(form, "idempotencyKey") || prev.idempotencyKey;

  const fieldErrors: CheckoutState["fieldErrors"] = { ...validateCard(card, getNow()) };
  const contact = contactSchema.safeParse(values);
  if (!contact.success) {
    for (const issue of contact.error.issues) {
      const key = issue.path[0] as "contactName" | "contactPhone";
      fieldErrors[key] ??= issue.message;
    }
  }
  if (form.get("terms") !== "on") fieldErrors.terms = "Accept the rental terms to continue";
  if (Object.keys(fieldErrors).length > 0) {
    return { idempotencyKey, fieldErrors, values, tone: "error", message: "Fix the highlighted fields. You have not been charged." };
  }

  const outcome = await submitCheckout(createAdminClient(), {
    userId: user.id,
    quoteId,
    idempotencyKey,
    contactName: values.contactName,
    contactPhone: values.contactPhone,
    cardNumber: card.number,
  });

  if (outcome.status === "confirmed") redirect(`/bookings/${outcome.bookingId}/confirmation`);

  // Any completed, unsuccessful attempt gets a fresh key so a retry is a new attempt.
  const next = { idempotencyKey: randomUUID(), fieldErrors: {}, values };
  switch (outcome.status) {
    case "payment_failed":
      return { ...next, tone: "error", message: "Your card was declined. No reservation was created and nothing was charged. You can try another test card." };
    case "unavailable":
      return { ...next, blocked: true, tone: "error", message: "This vehicle was just reserved by someone else for these dates. You have not been charged." };
    case "expired_refunded":
      return { ...next, blocked: true, tone: "warning", message: "Your checkout hold expired before payment completed. The simulated payment was refunded and no booking was created. Please start again." };
    case "idempotency_mismatch":
      return { ...next, tone: "warning", message: "This form was already submitted with different details. Review the details and submit again." };
    default:
      return {
        ...next,
        blocked: true,
        tone: "error",
        message:
          outcome.code === "quote_expired"
            ? "This price quote has expired. Go back to the vehicle to get a current price."
            : outcome.code === "price_changed"
              ? "The price for this vehicle changed after your quote. Go back to the vehicle to see the current price."
              : "We could not complete this booking. You have not been charged.",
      };
  }
}
