// LocationService. DEMO GAZETTEER: a small built-in list of Bay Area places,
// not a live geocoder. A suggestion here is not a booking guarantee.

export type Coordinates = { lat: number; lng: number };

export type KnownLocation = {
  id: string;
  label: string;
  aliases: string[];
  coordinates: Coordinates;
  timeZone: string;
};

const TZ = "America/Los_Angeles";

export const KNOWN_LOCATIONS: KnownLocation[] = [
  { id: "sjc", label: "San José Mineta International Airport (SJC)", aliases: ["sjc", "san jose airport", "mineta"], coordinates: { lat: 37.3639, lng: -121.9289 }, timeZone: TZ },
  { id: "san-jose", label: "San Jose, CA", aliases: ["san jose", "san josé", "san jose ca", "san jose, california"], coordinates: { lat: 37.3382, lng: -121.8863 }, timeZone: TZ },
  { id: "sjsu", label: "San José State University", aliases: ["sjsu", "san jose state"], coordinates: { lat: 37.3352, lng: -121.8811 }, timeZone: TZ },
  { id: "santa-clara", label: "Santa Clara, CA", aliases: ["santa clara"], coordinates: { lat: 37.3541, lng: -121.9552 }, timeZone: TZ },
  { id: "sunnyvale", label: "Sunnyvale, CA", aliases: ["sunnyvale"], coordinates: { lat: 37.3688, lng: -122.0363 }, timeZone: TZ },
  { id: "palo-alto", label: "Palo Alto, CA", aliases: ["palo alto"], coordinates: { lat: 37.4419, lng: -122.143 }, timeZone: TZ },
  { id: "fremont", label: "Fremont, CA", aliases: ["fremont"], coordinates: { lat: 37.5485, lng: -121.9886 }, timeZone: TZ },
  { id: "oak", label: "Oakland International Airport (OAK)", aliases: ["oak", "oakland airport", "oakland"], coordinates: { lat: 37.7126, lng: -122.2197 }, timeZone: TZ },
  { id: "sfo", label: "San Francisco International Airport (SFO)", aliases: ["sfo", "san francisco airport"], coordinates: { lat: 37.6213, lng: -122.379 }, timeZone: TZ },
  { id: "san-francisco", label: "San Francisco, CA", aliases: ["san francisco", "sf"], coordinates: { lat: 37.7749, lng: -122.4194 }, timeZone: TZ },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Resolve free text (or a location id) to a known location; null when unknown. */
export function resolveLocation(text: string): KnownLocation | null {
  const q = normalize(text);
  if (!q) return null;
  const exact = KNOWN_LOCATIONS.find(
    (l) => l.id === q || normalize(l.label) === q || l.aliases.some((a) => normalize(a) === q),
  );
  if (exact) return exact;
  // Fall back to a prefix match so "San Jose, CA 95112" or "Palo" still resolve.
  return (
    KNOWN_LOCATIONS.find((l) =>
      [l.label, ...l.aliases].some((name) => {
        const n = normalize(name);
        return q.startsWith(n) || (q.length >= 3 && n.startsWith(q));
      }),
    ) ?? null
  );
}

const EARTH_RADIUS_MILES = 3958.7613;

/** Straight-line (great-circle) distance in miles. */
export function distanceMiles(a: Coordinates, b: Coordinates): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Point `miles` from `origin` along `bearingDeg` (used by seed fixtures). */
export function offsetByMiles(origin: Coordinates, miles: number, bearingDeg: number): Coordinates {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const deg = (r: number) => (r * 180) / Math.PI;
  const d = miles / EARTH_RADIUS_MILES;
  const lat1 = rad(origin.lat);
  const lng1 = rad(origin.lng);
  const brg = rad(bearingDeg);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brg));
  const lng2 =
    lng1 +
    Math.atan2(Math.sin(brg) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: deg(lat2), lng: deg(lng2) };
}
