import type { ProviderAdapter, ProviderQuery } from "@/server/search/gateway";
import { offsetByMiles } from "@/server/search/location";
import type { PhotoCredit, VehicleListing } from "@/server/search/types";

// PUBLIC DEMO ADAPTER. Free, open data only. No rental company is scraped or
// contacted:
//  - Vehicle makes/models are checked against NHTSA vPIC, a free U.S.
//    government API whose data is public domain (no key needed).
//  - Photos come from Wikimedia Commons, limited to freely licensed images,
//    and every photo is shown with its author, license and source link.
//  - Prices, pickup points and availability are generated for the demo and
//    labeled as such everywhere. These are not real rental offers.
// Enabled only when PUBLIC_DEMO_LISTINGS=true.

export const PUBLIC_DEMO_KEY = "public-demo";
export const PUBLIC_DEMO_NAME = "Carrus demo listings (open data)";
const YEAR = 2024;
const USER_AGENT = "CarrusDemo/0.1 (non-commercial student class project)";
const CACHE_MS = 24 * 60 * 60 * 1000;
const LOOKUP_TIMEOUT_MS = 2500;

export const PUBLIC_DEMO_CATALOG: {
  id: string; make: string; model: string; type: VehicleListing["vehicleType"]; seats: number; dailyCents: number; transmission: string;
  /** Hand-picked current-generation exterior photo on Wikimedia Commons; its license is re-checked at runtime. */
  photo: string;
}[] = [
  { id: "PUB-TOYOTA-COROLLA", make: "Toyota", model: "Corolla", type: "Sedan", seats: 5, dailyCents: 4600, transmission: "Automatic", photo: "File:Toyota Corolla (E210) Washington DC Metro Area, USA.jpg" },
  { id: "PUB-HONDA-CIVIC", make: "Honda", model: "Civic", type: "Sedan", seats: 5, dailyCents: 4800, transmission: "Automatic", photo: "File:Honda Civic (FE) Washington DC Metro Area, USA.jpg" },
  { id: "PUB-TOYOTA-CAMRY", make: "Toyota", model: "Camry", type: "Sedan", seats: 5, dailyCents: 5400, transmission: "Automatic", photo: "File:Toyota Camry (XV70) Washington DC Metro Area, USA.jpg" },
  { id: "PUB-HYUNDAI-ELANTRA", make: "Hyundai", model: "Elantra", type: "Sedan", seats: 5, dailyCents: 4400, transmission: "Automatic", photo: "File:Hyundai Elantra (CN7) Washington DC Metro Area, USA.jpg" },
  { id: "PUB-TESLA-MODEL-3", make: "Tesla", model: "Model 3", type: "Sedan", seats: 5, dailyCents: 7900, transmission: "Automatic (electric)", photo: "File:Tesla Model 3 Washington DC Metro Area, USA.jpg" },
  { id: "PUB-TOYOTA-RAV4", make: "Toyota", model: "RAV4", type: "SUV", seats: 5, dailyCents: 6200, transmission: "Automatic", photo: "File:Toyota RAV4 (XA50) Washington DC Metro Area, USA (19).jpg" },
  { id: "PUB-HONDA-CR-V", make: "Honda", model: "CR-V", type: "SUV", seats: 5, dailyCents: 6400, transmission: "Automatic", photo: "File:HONDA CR-V SIXTH GENERATION China (32).jpg" },
  { id: "PUB-JEEP-GRAND-CHEROKEE", make: "Jeep", model: "Grand Cherokee", type: "SUV", seats: 5, dailyCents: 7600, transmission: "Automatic", photo: "File:Jeep Grand Cherokee (WL) Washington DC Metro Area, USA.jpg" },
  { id: "PUB-CHEVROLET-TAHOE", make: "Chevrolet", model: "Tahoe", type: "SUV", seats: 8, dailyCents: 11200, transmission: "Automatic", photo: "File:Chevrolet Tahoe (GMTT1XX) Washington DC Metro Area, USA.jpg" },
  { id: "PUB-CHRYSLER-PACIFICA", make: "Chrysler", model: "Pacifica", type: "Minivan", seats: 7, dailyCents: 8400, transmission: "Automatic", photo: "File:Chrysler Pacifica (RU) Washington DC Metro Area, USA.jpg" },
  { id: "PUB-FORD-MUSTANG", make: "Ford", model: "Mustang", type: "Sports", seats: 4, dailyCents: 9200, transmission: "Automatic", photo: "File:Ford Mustang GT (S650) Washington DC Metro Area, USA.jpg" },
  { id: "PUB-FORD-F-150", make: "Ford", model: "F-150", type: "Truck", seats: 5, dailyCents: 9800, transmission: "Automatic", photo: "File:2024 Ford F-150 Lariat front view.jpg" },
];

export function publicDemoEnabled(): boolean {
  return process.env.PUBLIC_DEMO_LISTINGS === "true";
}

// ------------------------------------------------------------------ caching
const memo = new Map<string, { at: number; value: Promise<unknown> }>();

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value as Promise<T>;
  const value = load();
  memo.set(key, { at: Date.now(), value });
  value.catch(() => memo.delete(key)); // retry failed lookups next time
  return value;
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    next: { revalidate: 86_400 },
  });
  if (!response.ok) throw new Error(`${new URL(url).hostname} returned ${response.status}`);
  return response.json();
}

// ------------------------------------------------------------------- NHTSA
/** Model names NHTSA lists for a make and year (lowercased). */
export function nhtsaModels(make: string, year = YEAR): Promise<Set<string>> {
  return cached(`nhtsa:${make}:${year}`, async () => {
    const url = `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${year}?format=json`;
    const data = (await getJson(url)) as { Results?: { Model_Name?: string }[] };
    return new Set((data.Results ?? []).map((r) => (r.Model_Name ?? "").trim().toLowerCase()).filter(Boolean));
  });
}

// --------------------------------------------------------- Wikimedia Commons
const FREE_LICENSE = /^(cc0|cc by(-sa)? [0-9.]+|public domain|pd\b)/i;

type CommonsPage = {
  title: string;
  missing?: boolean;
  imageinfo?: { thumburl?: string; descriptionurl?: string; mime?: string; extmetadata?: Record<string, { value?: string }> }[];
};

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

/** Credit for a Commons file, or null unless it is freely licensed and hosted by Wikimedia. */
export function commonsCredit(page: CommonsPage): PhotoCredit | null {
  const info = page.imageinfo?.[0];
  const meta = info?.extmetadata ?? {};
  const license = stripHtml(meta.LicenseShortName?.value ?? "");
  if (page.missing || !info?.thumburl || !info.descriptionurl) return null;
  if (!FREE_LICENSE.test(license)) return null;
  if (!/^image\/(jpeg|png|webp)$/.test(info.mime ?? "")) return null;
  if (!isWikimediaUrl(info.thumburl) || !isWikimediaUrl(info.descriptionurl)) return null;
  const licenseUrl = meta.LicenseUrl?.value;
  return {
    url: info.thumburl,
    title: page.title.replace(/^File:/, ""),
    author: stripHtml(meta.Artist?.value ?? "").slice(0, 120) || "Unknown author",
    license,
    licenseUrl: licenseUrl && /^https:\/\//.test(licenseUrl) ? licenseUrl : undefined,
    sourceUrl: info.descriptionurl,
  };
}

function isWikimediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && (parsed.hostname === "wikimedia.org" || parsed.hostname.endsWith(".wikimedia.org"));
  } catch {
    return false;
  }
}

/**
 * License, author and a 960px thumbnail for every catalog photo, in ONE API
 * request (cached for a day) to stay well within Wikimedia's usage limits.
 * Keyed by the File: title in the catalog.
 */
export function commonsPhotos(): Promise<Map<string, PhotoCredit>> {
  return cached("commons:catalog", async () => {
    const params = new URLSearchParams({
      action: "query", format: "json", formatversion: "2",
      titles: PUBLIC_DEMO_CATALOG.map((car) => car.photo).join("|"),
      prop: "imageinfo", iiprop: "url|extmetadata|mime", iiurlwidth: "960",
      iiextmetadatafilter: "LicenseShortName|Artist|LicenseUrl",
    });
    const data = (await getJson(`https://commons.wikimedia.org/w/api.php?${params}`)) as {
      query?: { pages?: CommonsPage[]; normalized?: { from: string; to: string }[] };
    };
    const byTitle = new Map((data.query?.pages ?? []).map((page) => [page.title, page]));
    for (const { from, to } of data.query?.normalized ?? []) {
      const page = byTitle.get(to);
      if (page) byTitle.set(from, page);
    }
    const credits = new Map<string, PhotoCredit>();
    for (const car of PUBLIC_DEMO_CATALOG) {
      const page = byTitle.get(car.photo);
      const credit = page ? commonsCredit(page) : null;
      if (credit) credits.set(car.photo, credit);
    }
    return credits;
  });
}

/** One catalog car's photo credit, or null when unavailable. */
export async function catalogPhoto(car: (typeof PUBLIC_DEMO_CATALOG)[number]): Promise<PhotoCredit | null> {
  return (await commonsPhotos()).get(car.photo) ?? null;
}

// ----------------------------------------------------------------- listings
function hash(text: string): number {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function buildPublicDemoListing(
  car: (typeof PUBLIC_DEMO_CATALOG)[number],
  query: Pick<ProviderQuery, "pickupAt" | "returnAt" | "coordinates" | "timeZone">,
  photo: PhotoCredit | null,
): VehicleListing {
  const days = Math.max(1, Math.ceil((query.returnAt.getTime() - query.pickupAt.getTime()) / 86_400_000));
  const baseCents = car.dailyCents * days;
  const feesCents = Math.round(baseCents * 0.12);
  const totalCents = baseCents + feesCents;
  const h = hash(car.id);
  return {
    id: `${PUBLIC_DEMO_KEY}:${car.id}`,
    providerKey: PUBLIC_DEMO_KEY,
    providerName: PUBLIC_DEMO_NAME,
    providerListingId: car.id,
    isMockSource: true,
    bookingCapability: "redirect",
    exactMatch: false,
    publicCode: car.id,
    make: car.make,
    model: car.model,
    year: YEAR,
    color: "",
    vehicleType: car.type,
    seats: car.seats,
    transmission: car.transmission,
    description: `${YEAR} ${car.make} ${car.model}, a real model listed in the NHTSA vehicle database. The price, pickup point and availability are generated for this Carrus demo; this is not a real rental offer.`,
    locationLabel: "Demo pickup point",
    coordinates: offsetByMiles(query.coordinates, 0.8 + (h % 60) / 10, h % 360),
    timeZone: query.timeZone ?? "America/Los_Angeles",
    distanceMiles: null,
    photoUrl: photo?.url ?? null,
    photoUrls: photo ? [photo.url] : [],
    photoCredit: photo ?? undefined,
    dailyRateCents: car.dailyCents,
    pricingPolicyId: null,
    partner: null,
    bookingMode: "instant",
    cancellationPolicy: "Demo policy: no real reservation is created.",
    sourceUrl: `/demo-source/${car.id}`,
    termsUrl: `/demo-source/${car.id}#terms`,
    checkoutDetails: "Carrus demo only. No rental company is involved and no payment is taken.",
    price: {
      currency: "USD",
      billableDays: days,
      dailyRateCents: car.dailyCents,
      baseCents,
      mandatoryFeesCents: feesCents,
      protectionCents: 0,
      taxCents: 0,
      totalCents,
      depositCents: 0,
      dueNowCents: totalCents,
      complete: true,
      policyVersion: "public-demo",
      lines: [
        { code: "base", label: `${days} day${days === 1 ? "" : "s"} × demo daily rate`, cents: baseCents },
        { code: "fees", label: "Demo taxes and fees (12%)", cents: feesCents },
      ],
      conditionalCharges: [],
    },
    lastUpdated: new Date().toISOString(),
  };
}

/** Resolves to `fallback` instead of failing or waiting past the budget. */
function settle<T>(promise: Promise<T>, fallback: T, ms = LOOKUP_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export const publicDemoAdapter: ProviderAdapter = {
  key: PUBLIC_DEMO_KEY,
  name: PUBLIC_DEMO_NAME,
  isMock: true,
  capability: "redirect",
  async search(query) {
    const makes = [...new Set(PUBLIC_DEMO_CATALOG.map((car) => car.make))];
    const [models, photos] = await Promise.all([
      Promise.all(makes.map((make) => settle(nhtsaModels(make).then((set): Set<string> | null => set), null))),
      settle(commonsPhotos(), new Map<string, PhotoCredit>()),
    ]);
    const modelsByMake = new Map(makes.map((make, i) => [make, models[i]]));
    return PUBLIC_DEMO_CATALOG.flatMap((car) => {
      // If NHTSA answered and does not list this model for the year, skip it.
      // If NHTSA is unreachable, keep the curated (real) catalog.
      const known = modelsByMake.get(car.make);
      if (known && known.size > 0 && !known.has(car.model.toLowerCase())) return [];
      return [buildPublicDemoListing(car, query, photos.get(car.photo) ?? null)];
    });
  },
};
