import type { Json } from "@/lib/supabase/database.types";
import type { Db } from "@/server/vehicles/repository";
import { configuredPartnerAdapters } from "@/server/search/providers/partner-feed";
import { demoExternalAdapter } from "@/server/search/providers/demo-external";
import type { ProviderQuery } from "@/server/search/gateway";
import type { VehicleListing } from "@/server/search/types";
import { chargeSimulated } from "@/server/payments/simulated";

export type ExternalDemoOrder = {
  id: string;
  customer_id: string;
  provider_key: string;
  provider_name: string;
  provider_listing_id: string;
  source_url: string;
  pickup_at: string;
  return_at: string;
  search_lat: number;
  search_lng: number;
  search_radius_miles: number;
  listing_snapshot: Json;
  total_cents: number;
  state: string;
  contact_name: string | null;
  contact_phone: string | null;
  demo_reference: string | null;
  expires_at: string;
  created_at: string;
  confirmed_at: string | null;
};

export async function freshExternalListing(key: string, listingId: string, query: ProviderQuery): Promise<VehicleListing | null> {
  const adapters = configuredPartnerAdapters();
  if (process.env.PROVIDER_MODE === "native+demo") adapters.push(demoExternalAdapter);
  const adapter = adapters.find((source) => source.key === key);
  if (!adapter) return null;
  const listings = await adapter.search(query);
  return listings.find((listing) => listing.providerListingId === listingId) ?? null;
}

export async function createExternalDemoOrder(
  admin: Db,
  input: { userId: string; providerKey: string; listingId: string; query: ProviderQuery },
): Promise<string | null> {
  const listing = await freshExternalListing(input.providerKey, input.listingId, input.query);
  if (!listing || !listing.sourceUrl || !listing.price.complete) return null;
  const { data, error } = await admin.from("external_demo_orders").insert({
    customer_id: input.userId,
    provider_key: listing.providerKey,
    provider_name: listing.providerName,
    provider_listing_id: listing.providerListingId,
    source_url: listing.sourceUrl,
    pickup_at: input.query.pickupAt.toISOString(),
    return_at: input.query.returnAt.toISOString(),
    search_lat: input.query.coordinates.lat,
    search_lng: input.query.coordinates.lng,
    search_radius_miles: Math.round(input.query.radiusMiles),
    listing_snapshot: listing as unknown as NonNullable<Json>,
    total_cents: listing.price.totalCents,
  }).select("id").single();
  if (error || !data) throw new Error(`Could not create external demo order: ${error?.message}`);
  return data.id;
}

export type ExternalDemoCheckoutResult = "confirmed" | "declined" | "expired" | "changed" | "missing";

export async function confirmExternalDemoOrder(
  admin: Db,
  input: { orderId: string; userId: string; name: string; phone: string; cardNumber: string },
): Promise<ExternalDemoCheckoutResult> {
  const { data: order } = await admin.from("external_demo_orders").select("*").eq("id", input.orderId).eq("customer_id", input.userId).maybeSingle();
  if (!order) return "missing";
  if (order.state === "confirmed") return "confirmed";
  if (new Date(order.expires_at).getTime() <= Date.now()) return "expired";
  let fresh: VehicleListing | null;
  try {
    fresh = await freshExternalListing(order.provider_key, order.provider_listing_id, {
      pickupAt: new Date(order.pickup_at), returnAt: new Date(order.return_at),
      coordinates: { lat: order.search_lat, lng: order.search_lng }, radiusMiles: order.search_radius_miles,
    });
  } catch {
    return "changed";
  }
  if (!fresh || fresh.price.totalCents !== order.total_cents || fresh.sourceUrl !== order.source_url) return "changed";
  const payment = await chargeSimulated({ attemptId: order.id, amountCents: order.total_cents, cardNumber: input.cardNumber });
  if (!payment.ok) return "declined";
  const { data, error } = await admin.from("external_demo_orders").update({
    state: "confirmed", contact_name: input.name, contact_phone: input.phone,
    demo_reference: `DEMO-${order.id.slice(0, 8).toUpperCase()}`, confirmed_at: new Date().toISOString(),
  }).eq("id", order.id).eq("customer_id", input.userId).eq("state", "pending").gt("expires_at", new Date().toISOString()).select("id").maybeSingle();
  if (error) throw new Error(`Could not finish external demo checkout: ${error.message}`);
  if (data) return "confirmed";
  const { data: latest } = await admin.from("external_demo_orders").select("state").eq("id", order.id).maybeSingle();
  return latest?.state === "confirmed" ? "confirmed" : "expired";
}
