import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GarageArt, KeyArt, ReceiptArt, RoadArt } from "@/components/illustrations";
import { Reveal } from "@/components/reveal";
import { SearchForm } from "@/components/search-form";
import { SourcesMarquee } from "@/components/sources-marquee";
import { btnPrimary, eyebrowCls } from "@/components/ui";
import { FeaturedCard } from "@/components/vehicle-card";
import { getNow } from "@/lib/clock";
import { getPreferences, preferenceSearchParams } from "@/lib/preferences";
import { createClient } from "@/lib/supabase/server";
import { DAY_MS, utcToZonedLocal, zonedLocalToUtc } from "@/lib/time";
import { parsePartnerFeedConfig } from "@/server/search/providers/partner-feed";
import { listPublishedRows, toListing } from "@/server/vehicles/repository";

export const dynamic = "force-dynamic";

const TZ = "America/Los_Angeles";

function defaultTrip() {
  const tomorrow = utcToZonedLocal(new Date(getNow().getTime() + DAY_MS), TZ).slice(0, 10);
  const later = utcToZonedLocal(new Date(getNow().getTime() + 5 * DAY_MS), TZ).slice(0, 10);
  return { pickup: `${tomorrow}T10:00`, return: `${later}T10:00` };
}

const STEPS = [
  { art: RoadArt, title: "Search", body: "Where and when you need a car." },
  { art: ReceiptArt, title: "Compare", body: "Real totals, fees included." },
  { art: KeyArt, title: "Reserve", body: "Book the exact car you picked." },
];

export default async function HomePage() {
  const connectedSources = parsePartnerFeedConfig(process.env.PARTNER_FEEDS_JSON).map((feed) => feed.name);
  const prefs = await getPreferences();
  const dates = defaultTrip();
  const db = await createClient();
  // The home page should still render if the database is briefly unreachable.
  const rows = await listPublishedRows(db, 24).catch((error: unknown) => {
    console.warn("[home] featured vehicles unavailable:", error instanceof Error ? error.message : error);
    return [];
  });
  const pickupAt = zonedLocalToUtc(dates.pickup, TZ)!;
  const returnAt = zonedLocalToUtc(dates.return, TZ)!;
  const listings = rows.map((r) => toListing(r, pickupAt, returnAt)).sort((a, b) => Number(Boolean(b.photoUrl)) - Number(Boolean(a.photoUrl)));
  const place = prefs.homeLocation || listings[0]?.locationLabel || "San Jose, CA";
  const city = place.replace(/, CA$/, "").replace(/ \(.*\)$/, "");
  const trip = { pickup: dates.pickup, ret: dates.return, location: place };
  const prefParams = preferenceSearchParams(prefs);
  const searchHref = (extra: Record<string, string> = {}, location = place) => {
    const params = new URLSearchParams({ location, pickup: dates.pickup, return: dates.return });
    for (const [k, v] of Object.entries({ ...prefParams, ...extra })) {
      params.delete(k);
      for (const item of Array.isArray(v) ? v : [v]) params.append(k, item);
    }
    return `/search?${params.toString()}`;
  };
  const chips = [
    { label: "SJC airport", href: searchHref({}, "SJC") },
    { label: "SUVs", href: searchHref({ type: "SUV" }) },
    { label: "Sports", href: searchHref({ type: "Sports" }) },
    { label: "7+ seats", href: searchHref({ seats: "7" }) },
  ];

  return (
    <main className="flex-1">
      {/* Hero: one headline, one sentence, one search. */}
      <section className="relative mx-auto max-w-6xl px-4 pt-14 sm:px-6 sm:pt-20">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-24 -z-10 h-80 overflow-hidden">
          <div className="mx-auto h-full w-[min(36rem,90%)] rounded-full bg-accent-soft opacity-80 blur-3xl" />
        </div>
        <h1 className="max-w-4xl text-[clamp(3rem,7.5vw,6rem)] leading-[0.98] tracking-[-0.035em]">Find your next drive.</h1>
        <p className="mt-5 max-w-md text-lg text-gray-600">Exact cars. <span className="text-accent">Real totals.</span> No surprises.</p>

        <div className="relative mt-10">
          <div className="photo-luxe clip-reveal relative aspect-[16/9] overflow-hidden rounded-3xl sm:aspect-[21/8]">
            <Image src="/hero.jpg" alt="" fill priority sizes="(min-width: 1152px) 1152px, 100vw" className="object-cover" />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
          </div>
          <div id="search" className="relative z-10 -mt-10 scroll-mt-28 px-2 sm:-mt-14 sm:px-8">
            <h2 className="sr-only">Search vehicles</h2>
            <SearchForm defaults={{ ...dates, location: prefs.homeLocation || undefined }} hidden={prefParams} />
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Quick searches">
              {chips.map((c) => (
                <li key={c.label}>
                  <Link
                    href={c.href}
                    className="inline-block rounded-full border border-gray-300 px-4 py-1.5 text-sm text-gray-700 hover:border-accent hover:bg-accent hover:text-accent-contrast focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-28 px-4 pt-24 sm:px-6">
        {/* How it works: three words, three drawings. */}
        <section aria-labelledby="how-heading">
          <h2 id="how-heading" className="text-center text-4xl sm:text-5xl">How it works</h2>
          <ul className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map(({ art: Art, title, body }, i) => (
              <Reveal as="li" key={title} delay={i * 120} className="group list-none text-center">
                <div className="lift mx-auto flex aspect-[16/9] items-center justify-center rounded-3xl bg-accent-soft p-6 sm:aspect-[4/3] sm:p-8 transition-colors duration-500 group-hover:bg-white">
                  <Art className="h-full w-full text-gray-900 transition-transform duration-700 ease-[var(--ease-luxe)] group-hover:scale-105" />
                </div>
                <h3 className="mt-5 text-xl">
                  <span className="mr-2 text-accent">0{i + 1}</span>
                  {title}
                </h3>
                <p className="mt-1 text-gray-600">{body}</p>
              </Reveal>
            ))}
          </ul>
        </section>

        {listings.length > 0 && (
          <section aria-labelledby="fleet-row">
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
              <h2 id="fleet-row" className="min-w-0 text-4xl sm:text-5xl">Popular in {city}</h2>
              <Link href={searchHref()} className="group inline-flex shrink-0 items-center gap-2 py-2 text-sm font-medium text-gray-900">
                View all <ArrowRight className="size-4 transition-transform duration-500 group-hover:translate-x-1" aria-hidden />
              </Link>
            </div>
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {listings.slice(0, 3).map((l, i) => (
                <Reveal as="li" key={l.id} delay={i * 90} className="list-none">
                  <FeaturedCard listing={l} trip={trip} />
                </Reveal>
              ))}
            </ul>
          </section>
        )}

        <Reveal>
          <SourcesMarquee connectedSources={connectedSources} />
        </Reveal>

        <Reveal>
          <section aria-labelledby="fleet-heading" className="overflow-hidden rounded-3xl bg-night px-7 py-14 text-snow sm:px-14 sm:py-16">
            <div className="grid items-center gap-10 md:grid-cols-[1fr_auto]">
              <div>
                <p className={`${eyebrowCls} !border-snow/40 !text-snow/80`}>Carrus fleet</p>
                <h2 id="fleet-heading" className="mt-5 text-4xl !text-snow sm:text-6xl">
                  Car sitting idle? <span className="text-snow/60">Put it to work.</span>
                </h2>
                <Link href="/join-the-fleet" className={`${btnPrimary} mt-8 !bg-snow !text-[#111] hover:!bg-[#ffffff]`}>
                  List your car <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
              <GarageArt className="hidden h-44 w-60 text-snow md:block" />
            </div>
          </section>
        </Reveal>
      </div>
    </main>
  );
}
