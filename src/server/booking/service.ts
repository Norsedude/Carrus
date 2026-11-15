import { createHash } from "node:crypto";
import type { Json } from "@/lib/supabase/database.types";
import { chargeSimulated } from "@/server/payments/simulated";
import type { PriceBreakdown } from "@/server/pricing/pricing";
import { availableVehicleIds, getVehicleRow, toListing, type Db } from "@/server/vehicles/repository";

// BookingService. Callers must pass the privileged (service-role) client and
// an already-authenticated user id; the browser never supplies totals, roles
// or payment status. Exclusive availability is enforced by the database
// (occupancy exclusion constraint), not by check-then-insert code here.

export const QUOTE_TTL_MINUTES = 15;
/** Proposed default checkout hold (D-009). */
export const HOLD_SECONDS = 600;

export type VehicleSnapshot = {
  vehicleId: string;
  publicCode: string;
  make: string;
  model: string;
  year: number;
  color: string;
  vehicleType: string;
  seats: number;
  transmission: string;
  locationLabel: string;
  timeZone: string;
  dailyRateCents: number;
  pricingPolicyId: string;
  partnerId: string;
  partnerName: string;
  bookingMode: string;
  cancellationPolicy: string;
  photoUrl?: string | null;
};

export type QuoteRecord = {
  id: string;
  userId: string | null;
  vehicleId: string;
  pickupAt: string;
  returnAt: string;
  expiresAt: string;
  totalCents: number;
  breakdown: PriceBreakdown;
  vehicle: VehicleSnapshot;
};

export type CreateQuoteResult =
  | { ok: true; quoteId: string }
  | { ok: false; code: "not_found" | "unavailable" };

/** Server-calculated, immutable quote. Viewing or creating one never books anything. */
export async function createQuote(
  admin: Db,
  input: { vehicleId: string; pickupAt: Date; returnAt: Date; userId: string | null },
): Promise<CreateQuoteResult> {
  const row = await getVehicleRow(admin, input.vehicleId);
  if (
    !row ||
    row.lifecycle_status !== "published" ||
    row.partner.verification_status !== "verified" ||
    row.provider.capability !== "native_booking"
  ) {
    return { ok: false, code: "not_found" };
  }
  const available = await availableVehicleIds(admin, input.pickupAt, input.returnAt);
  if (!available.includes(row.id)) return { ok: false, code: "unavailable" };

  const listing = toListing(row, input.pickupAt, input.returnAt);
  const snapshot: VehicleSnapshot = {
    vehicleId: row.id,
    publicCode: row.public_code,
    make: row.make,
    model: row.model,
    year: row.year,
    color: row.color,
    vehicleType: row.vehicle_type,
    seats: row.seats,
    transmission: row.transmission,
    locationLabel: row.location_label,
    timeZone: row.time_zone,
    dailyRateCents: row.daily_rate_cents,
    pricingPolicyId: row.policy.id,
    partnerId: row.partner.id,
    partnerName: row.partner.display_name,
    bookingMode: row.booking_mode,
    cancellationPolicy: row.cancellation_policy,
    photoUrl: listing.photoUrl,
  };
  const { data, error } = await admin
    .from("quotes")
    .insert({
      user_id: input.userId,
      vehicle_id: row.id,
      pickup_at: input.pickupAt.toISOString(),
      return_at: input.returnAt.toISOString(),
      expires_at: new Date(Date.now() + QUOTE_TTL_MINUTES * 60_000).toISOString(),
      policy_version: listing.price.policyVersion,
      total_cents: listing.price.totalCents,
      breakdown: listing.price as unknown as NonNullable<Json>,
      vehicle_snapshot: snapshot as unknown as NonNullable<Json>,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`could not save quote: ${error?.message}`);
  return { ok: true, quoteId: data.id };
}

export type QuoteStatus = "ok" | "expired" | "unavailable" | "price_changed";
export type QuoteView =
  | { kind: "quote"; quote: QuoteRecord; status: QuoteStatus }
  | { kind: "booked"; bookingId: string };

/**
 * Load a quote for preconfirmation/checkout with a fresh availability and
 * price check. Returns null when it does not exist or belongs to someone else.
 */
export async function getQuoteView(admin: Db, quoteId: string, viewerId: string | null): Promise<QuoteView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(quoteId)) return null;
  const { data: q } = await admin.from("quotes").select("*").eq("id", quoteId).maybeSingle();
  if (!q) return null;
  if (q.user_id && q.user_id !== viewerId) return null;

  if (viewerId) {
    const { data: booking } = await admin
      .from("bookings")
      .select("id")
      .eq("quote_id", q.id)
      .eq("customer_id", viewerId)
      .maybeSingle();
    if (booking) return { kind: "booked", bookingId: booking.id };
  }

  const quote: QuoteRecord = {
    id: q.id,
    userId: q.user_id,
    vehicleId: q.vehicle_id,
    pickupAt: q.pickup_at,
    returnAt: q.return_at,
    expiresAt: q.expires_at,
    totalCents: q.total_cents,
    breakdown: q.breakdown as unknown as PriceBreakdown,
    vehicle: q.vehicle_snapshot as unknown as VehicleSnapshot,
  };

  let status: QuoteStatus = "ok";
  const row = await getVehicleRow(admin, q.vehicle_id);
  if (new Date(q.expires_at).getTime() <= Date.now()) {
    status = "expired";
  } else if (!row || row.lifecycle_status !== "published") {
    status = "unavailable";
  } else if (
    row.daily_rate_cents !== quote.vehicle.dailyRateCents ||
    row.policy.id !== quote.vehicle.pricingPolicyId
  ) {
    status = "price_changed";
  } else {
    const available = await availableVehicleIds(admin, new Date(q.pickup_at), new Date(q.return_at));
    if (!available.includes(q.vehicle_id)) status = "unavailable";
  }
  return { kind: "quote", quote, status };
}

export type CheckoutOutcome =
  | { status: "confirmed"; bookingId: string }
  | { status: "payment_failed"; code: string }
  | { status: "unavailable" }
  | { status: "expired_refunded" }
  | { status: "idempotency_mismatch" }
  | { status: "rejected"; code: string };

type RpcResult = {
  status: string;
  attempt_id?: string;
  booking_id?: string | null;
  failure_code?: string | null;
  amount_cents?: number;
};

function toOutcome(r: RpcResult): CheckoutOutcome {
  switch (r.status) {
    case "confirmed":
      return { status: "confirmed", bookingId: r.booking_id as string };
    case "payment_failed":
      return { status: "payment_failed", code: r.failure_code ?? "declined" };
    case "unavailable":
      return { status: "unavailable" };
    case "expired_refunded":
      return { status: "expired_refunded" };
    case "idempotency_mismatch":
      return { status: "idempotency_mismatch" };
    default:
      return { status: "rejected", code: r.failure_code ?? r.status };
  }
}

/**
 * Checkout: claim an exclusive hold (idempotent per user + key), take the
 * simulated payment, then finalize from the authoritative payment result.
 * The same key with the same input always returns the same outcome; the same
 * key with different input is rejected.
 */
export async function submitCheckout(
  admin: Db,
  input: {
    userId: string;
    quoteId: string;
    idempotencyKey: string;
    contactName: string;
    contactPhone: string;
    cardNumber: string;
  },
  options: { holdSeconds?: number; paymentDelayMs?: number } = {},
): Promise<CheckoutOutcome> {
  const last4 = input.cardNumber.replace(/\D/g, "").slice(-4);
  const requestHash = createHash("sha256")
    .update(JSON.stringify([input.quoteId, input.contactName, input.contactPhone, last4]))
    .digest("hex");

  const begin = await admin.rpc("begin_booking", {
    _user: input.userId,
    _quote: input.quoteId,
    _key: input.idempotencyKey,
    _hash: requestHash,
    _contact_name: input.contactName,
    _contact_phone: input.contactPhone,
    _hold_seconds: options.holdSeconds ?? HOLD_SECONDS,
  });
  if (begin.error) throw new Error(`begin_booking failed: ${begin.error.message}`);
  const held = begin.data as RpcResult;
  if (held.status !== "held" || !held.attempt_id) return toOutcome(held);

  const { data: quote } = await admin.from("quotes").select("total_cents").eq("id", input.quoteId).single();
  const payment = await chargeSimulated({
    attemptId: held.attempt_id,
    amountCents: quote?.total_cents ?? 0,
    cardNumber: input.cardNumber,
    delayMs: options.paymentDelayMs,
  });

  const fin = await admin.rpc("finalize_booking", {
    _attempt: held.attempt_id,
    _payment_ok: payment.ok,
    _provider_ref: payment.providerRef,
    _detail: payment.detail,
  });
  if (fin.error) {
    // A concurrent replay of the same attempt may have finalized first.
    const again = await admin.rpc("finalize_booking", {
      _attempt: held.attempt_id,
      _payment_ok: payment.ok,
      _provider_ref: `${payment.providerRef}_retry`,
      _detail: payment.detail,
    });
    if (again.error) throw new Error(`finalize_booking failed: ${fin.error.message}`);
    return toOutcome(again.data as RpcResult);
  }
  return toOutcome(fin.data as RpcResult);
}
