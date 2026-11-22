import { z } from "zod";
import type { ProviderAdapter, ProviderQuery } from "@/server/search/gateway";
import type { VehicleListing } from "@/server/search/types";

// A provider-controlled, authorized JSON feed. This is deliberately not an HTML
// scraper: the companies shown in the home-page marquee have not granted access.
const httpsUrl = z.url().refine((value) => new URL(value).protocol === "https:");
const cents = z.number().int().nonnegative();
const configSchema = z.array(z.object({
  key: z.string().regex(/^[a-z0-9-]{2,40}$/),
  name: z.string().min(2).max(80),
  url: httpsUrl,
  token: z.string().min(1),
  allowedHosts: z.array(z.string().min(3)).min(1),
  imageHosts: z.array(z.string().min(3)).default([]),
})).max(10);

const listingSchema = z.object({
  id: z.string().min(1).max(150),
  make: z.string().min(1).max(80),
  model: z.string().min(1).max(80),
  year: z.number().int().min(1900).max(2100),
  color: z.string().max(80).default(""),
  vehicleType: z.enum(["Sedan", "SUV", "Sports", "Luxury", "Minivan", "Van", "Truck"]),
  seats: z.number().int().min(1).max(30),
  transmission: z.string().min(1).max(80),
  description: z.string().max(5000).default(""),
  locationLabel: z.string().min(1).max(200),
  coordinates: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
  timeZone: z.string().min(1).max(100),
  exactMatch: z.boolean(),
  photoUrls: z.array(httpsUrl).max(12).default([]),
  sourceUrl: httpsUrl,
  termsUrl: httpsUrl,
  checkoutDetails: z.string().min(1).max(3000),
  cancellationPolicy: z.string().min(1).max(300),
  price: z.object({
    currency: z.literal("USD"),
    billableDays: z.number().int().positive(),
    dailyRateCents: cents,
    totalCents: cents,
    dueNowCents: cents,
    depositCents: cents,
    lines: z.array(z.object({ code: z.string().min(1), label: z.string().min(1), cents })).min(1).max(30),
  }),
});
const responseSchema = z.object({
  searchedAt: z.iso.datetime(),
  listings: z.array(listingSchema).max(100),
});

export type PartnerFeedConfig = z.infer<typeof configSchema>[number];

export function parsePartnerFeedConfig(raw: string | undefined): PartnerFeedConfig[] {
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  const feeds = configSchema.parse(parsed);
  if (new Set(feeds.map((feed) => feed.key)).size !== feeds.length || feeds.some((feed) => feed.key === "carrus" || feed.key === "demo-external")) {
    throw new Error("Partner feed keys must be unique and cannot use reserved keys");
  }
  for (const feed of feeds) {
    if (feed.allowedHosts.some((host) => !validHost(host)) || feed.imageHosts.some((host) => !validHost(host))) {
      throw new Error(`Invalid allowed host for ${feed.key}`);
    }
  }
  return feeds;
}

function validHost(host: string): boolean {
  return /^[a-z0-9.-]+$/i.test(host) && !host.startsWith(".") && !host.endsWith(".") && !host.includes("..");
}

function allowedUrl(url: string, hosts: string[]): boolean {
  return hosts.includes(new URL(url).hostname.toLowerCase());
}

export function normalizePartnerListing(raw: z.infer<typeof listingSchema>, feed: PartnerFeedConfig, searchedAt: string): VehicleListing {
  if (!allowedUrl(raw.sourceUrl, feed.allowedHosts) || !allowedUrl(raw.termsUrl, feed.allowedHosts)) {
    throw new Error("Partner feed returned a link outside its allowed hosts");
  }
  if (raw.photoUrls.some((url) => !allowedUrl(url, feed.imageHosts))) {
    throw new Error("Partner feed returned a photo outside its allowed image hosts");
  }
  if (raw.price.lines.reduce((sum, line) => sum + line.cents, 0) !== raw.price.totalCents) {
    throw new Error("Partner feed price lines do not equal the total");
  }
  if (raw.price.dueNowCents > raw.price.totalCents) {
    throw new Error("Partner feed due-now amount exceeds the total");
  }
  return {
    id: `${feed.key}:${raw.id}`,
    providerKey: feed.key,
    providerName: feed.name,
    providerListingId: raw.id,
    isMockSource: false,
    bookingCapability: "redirect",
    exactMatch: raw.exactMatch,
    publicCode: raw.id,
    make: raw.make,
    model: raw.model,
    year: raw.year,
    color: raw.color,
    vehicleType: raw.vehicleType,
    seats: raw.seats,
    transmission: raw.transmission,
    description: raw.description,
    locationLabel: raw.locationLabel,
    coordinates: raw.coordinates,
    timeZone: raw.timeZone,
    distanceMiles: null,
    photoUrl: raw.photoUrls[0] ?? null,
    photoUrls: raw.photoUrls,
    dailyRateCents: raw.price.dailyRateCents,
    pricingPolicyId: null,
    partner: null,
    bookingMode: "instant",
    cancellationPolicy: raw.cancellationPolicy,
    sourceUrl: raw.sourceUrl,
    termsUrl: raw.termsUrl,
    checkoutDetails: raw.checkoutDetails,
    price: {
      currency: "USD",
      billableDays: raw.price.billableDays,
      dailyRateCents: raw.price.dailyRateCents,
      baseCents: raw.price.lines.find((line) => line.code === "base")?.cents ?? 0,
      mandatoryFeesCents: 0,
      protectionCents: 0,
      taxCents: 0,
      totalCents: raw.price.totalCents,
      dueNowCents: raw.price.dueNowCents,
      depositCents: raw.price.depositCents,
      complete: true,
      policyVersion: `${feed.key}-feed`,
      lines: raw.price.lines,
      conditionalCharges: [],
    },
    lastUpdated: searchedAt,
  };
}

export function partnerFeedAdapter(feed: PartnerFeedConfig): ProviderAdapter {
  return {
    key: feed.key,
    name: feed.name,
    isMock: false,
    capability: "redirect",
    async search(query: ProviderQuery) {
      const url = new URL(feed.url);
      url.searchParams.set("pickupAt", query.pickupAt.toISOString());
      url.searchParams.set("returnAt", query.returnAt.toISOString());
      url.searchParams.set("lat", String(query.coordinates.lat));
      url.searchParams.set("lng", String(query.coordinates.lng));
      url.searchParams.set("radiusMiles", String(query.radiusMiles));
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${feed.token}`, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(3500),
        redirect: "error",
      });
      if (!response.ok) throw new Error(`partner feed returned ${response.status}`);
      const body = await response.text();
      if (body.length > 2_000_000) throw new Error("partner feed response too large");
      const data = responseSchema.parse(JSON.parse(body));
      const ageMs = Date.now() - new Date(data.searchedAt).getTime();
      if (ageMs < -60_000 || ageMs > 15 * 60_000) throw new Error("partner feed data is stale");
      return data.listings.map((listing) => normalizePartnerListing(listing, feed, data.searchedAt));
    },
  };
}

export function configuredPartnerAdapters(): ProviderAdapter[] {
  return parsePartnerFeedConfig(process.env.PARTNER_FEEDS_JSON).map(partnerFeedAdapter);
}
