// Extracts rental-listing details from a page's public metadata: Open Graph
// and Twitter tags, schema.org JSON-LD (Product / Car / Vehicle / Offer) and,
// as a last resort, a "$NN/day" price in the visible text. Pure function so
// it can be unit-tested; anything not found is left blank for the user.

export type LinkPreview = {
  url: string;
  site: string;
  title: string;
  description: string;
  imageUrl: string | null;
  make: string;
  model: string;
  year: number | null;
  vehicleType: string;
  seats: number | null;
  transmission: string;
  /** Per-day price in cents, if the page states one. */
  dailyCents: number | null;
  /** Total price in cents, if the page states one. */
  totalCents: number | null;
  currency: string;
  /** Which fields came from the page, for the UI to show what to check. */
  found: string[];
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'", "#x27": "'", "#x2F": "/" };
export function decodeEntities(s: string): string {
  return s
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+\d*);/gi, (m, e: string) => {
      if (ENTITIES[e] !== undefined) return ENTITIES[e];
      if (e[0] === "#") {
        const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
      }
      return m;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function metaTags(html: string): Map<string, string> {
  const map = new Map<string, string>();
  const head = html.slice(0, 400_000);
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const attr = (name: string) => new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
    const key = attr("property") ?? attr("name") ?? attr("itemprop");
    const content = attr("content");
    if (!key || !content) continue;
    const k = (key[2] ?? key[3] ?? key[4] ?? "").toLowerCase();
    const v = decodeEntities(content[2] ?? content[3] ?? content[4] ?? "");
    if (k && v && !map.has(k)) map.set(k, v);
  }
  return map;
}

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
function jsonLdNodes(html: string): Record<string, Json>[] {
  const out: Record<string, Json>[] = [];
  const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 50) {
    try {
      const walk = (v: Json) => {
        if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v === "object") {
          out.push(v);
          if (v["@graph"]) walk(v["@graph"]);
          if (v.mainEntity) walk(v.mainEntity);
          if (v.itemOffered) walk(v.itemOffered);
        }
      };
      walk(JSON.parse(m[1].trim()) as Json);
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  }
  return out;
}

const str = (v: Json | undefined): string =>
  typeof v === "string" ? decodeEntities(v) : typeof v === "number" ? String(v) : v && typeof v === "object" && !Array.isArray(v) && typeof v.name === "string" ? decodeEntities(v.name) : "";
const types = (n: Record<string, Json>) => (Array.isArray(n["@type"]) ? n["@type"] : [n["@type"]]).map((t) => String(t ?? "").toLowerCase());

/** Parses "$1,234.56", "1234.5", "USD 45" into cents; null if not a sane price. */
export function toCents(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0 || n > 100_000) return null;
  return Math.round(n * 100);
}

const TYPE_WORDS: [RegExp, string][] = [
  [/\b(minivan|mini-van)\b/i, "Minivan"],
  [/\b(suv|crossover)\b/i, "SUV"],
  [/\b(pickup|truck)\b/i, "Truck"],
  [/\bvan\b/i, "Van"],
  [/\b(convertible|coupe|sports?\s?car|roadster)\b/i, "Sports"],
  [/\b(luxury|premium)\b/i, "Luxury"],
  [/\b(sedan|saloon|hatchback|compact|economy)\b/i, "Sedan"],
];

export function parseListing(html: string, pageUrl: string): LinkPreview {
  const url = new URL(pageUrl);
  const meta = metaTags(html);
  const nodes = jsonLdNodes(html);
  const found = new Set<string>();
  const get = (...keys: string[]) => keys.map((k) => meta.get(k)).find(Boolean) ?? "";

  const titleTag = decodeEntities(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "");
  const vehicle = nodes.find((n) => types(n).some((t) => ["car", "vehicle", "motorizedbicycle", "product"].includes(t)));
  const offerNode =
    nodes.find((n) => types(n).some((t) => t === "offer" || t === "aggregateoffer")) ??
    (vehicle?.offers && typeof vehicle.offers === "object" ? (Array.isArray(vehicle.offers) ? (vehicle.offers[0] as Record<string, Json>) : (vehicle.offers as Record<string, Json>)) : undefined);

  let title = str(vehicle?.name) || get("og:title", "twitter:title") || titleTag;
  if (title) found.add("title");
  const description = (str(vehicle?.description) || get("og:description", "twitter:description", "description")).slice(0, 400);
  const site = get("og:site_name") || url.hostname.replace(/^www\./, "");

  let imageUrl: string | null = null;
  const rawImage = (Array.isArray(vehicle?.image) ? str((vehicle.image as Json[])[0]) : str(vehicle?.image)) || get("og:image:secure_url", "og:image", "twitter:image", "twitter:image:src");
  try {
    if (rawImage) {
      const abs = new URL(rawImage, url);
      if (abs.protocol === "https:" || abs.protocol === "http:") {
        imageUrl = abs.toString();
        found.add("photo");
      }
    }
  } catch {
    imageUrl = null;
  }

  let make = str(vehicle?.brand) || str(vehicle?.manufacturer);
  let model = str(vehicle?.model);
  let year: number | null = Number(str(vehicle?.vehicleModelDate) || str(vehicle?.modelDate) || str(vehicle?.productionDate).slice(0, 4)) || null;
  const text = `${title} ${description}`;
  if (!year) {
    const y = /\b(19[89]\d|20[0-4]\d)\b/.exec(text);
    if (y) year = Number(y[1]);
  }
  if (year && (year < 1980 || year > 2100)) year = null;
  if (!make || !model) {
    // "2024 Toyota Camry ..." in the title.
    const m = /\b(?:19|20)\d{2}\s+([A-Z][A-Za-z-]+)\s+([A-Z0-9][\w-]*(?:\s+[A-Z0-9][\w-]*)?)/.exec(title);
    if (m) {
      make ||= m[1];
      model ||= m[2];
    }
  }
  if (make) found.add("make");
  if (model) found.add("model");
  if (year) found.add("year");

  const seats = Number(str(vehicle?.seatingCapacity)) || Number(/\b(\d{1,2})\s*(?:seats|seater|passengers)\b/i.exec(text)?.[1]) || null;
  if (seats) found.add("seats");
  const transmissionRaw = str(vehicle?.vehicleTransmission) || (/\b(automatic|manual)\b/i.exec(text)?.[1] ?? "");
  const transmission = /manual/i.test(transmissionRaw) ? "Manual" : transmissionRaw ? "Automatic" : "";
  if (transmission) found.add("transmission");
  const bodyType = str(vehicle?.bodyType) || text;
  const vehicleType = TYPE_WORDS.find(([re]) => re.test(bodyType))?.[1] ?? "";
  if (vehicleType) found.add("type");

  const currency = (str(offerNode?.priceCurrency) || get("product:price:currency", "og:price:currency") || "USD").toUpperCase();
  let dailyCents: number | null = null;
  let totalCents: number | null = null;
  const offerPrice = toCents(str(offerNode?.price) || str(offerNode?.lowPrice) || get("product:price:amount", "og:price:amount"));
  const unit = `${str(offerNode?.priceSpecification)} ${str((offerNode?.priceSpecification as Record<string, Json> | undefined)?.unitText)} ${str(offerNode?.unitText)}`.toLowerCase();
  if (offerPrice) {
    if (/day|daily|night/.test(unit)) dailyCents = offerPrice;
    else totalCents = offerPrice;
  }
  if (!dailyCents) {
    const visible = html.slice(0, 600_000).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
    const perDay = /\$\s?(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)\s*(?:\/|per|a)\s*(?:day|daily)\b/i.exec(decodeEntities(visible));
    if (perDay) dailyCents = toCents(perDay[1]);
  }
  if (dailyCents) found.add("dailyRate");
  if (totalCents) found.add("total");

  if (title.length > 120) title = `${title.slice(0, 117)}…`;
  return {
    url: url.toString(),
    site,
    title,
    description,
    imageUrl,
    make: make.slice(0, 40),
    model: model.slice(0, 40),
    year,
    vehicleType,
    seats: seats && seats >= 1 && seats <= 15 ? seats : null,
    transmission,
    dailyCents,
    totalCents,
    currency,
    found: [...found],
  };
}
