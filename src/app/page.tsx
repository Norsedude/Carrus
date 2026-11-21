import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Car, DollarSign, Search, ShieldCheck } from "lucide-react";
import { SearchForm } from "@/components/search-form";
import { SourcesMarquee } from "@/components/sources-marquee";
import { btnPrimary, btnSecondary, cardCls } from "@/components/ui";
import { FeaturedCard } from "@/components/vehicle-card";
import { getNow } from "@/lib/clock";
import { createClient } from "@/lib/supabase/server";
import { DAY_MS, utcToZonedLocal, zonedLocalToUtc } from "@/lib/time";
import type { VehicleListing } from "@/server/search/types";
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
  { icon: Search, title: "Search available vehicles", body: "Filter Carrus and connected listings by where and when you need a car. Some external offers may be for a similar vehicle." },
  { icon: DollarSign, title: "Compare the real total", body: "Every result shows taxes, fees and protection up front, so the cheapest car is actually the cheapest." },
  { icon: Car, title: "Reserve your choice", body: "Book exact Carrus vehicles here. For external offers, confirm the details and book on the provider website." },
];

const PROMISES = [
  { icon: ShieldCheck, title: "Transparent pricing", body: "See itemized totals. Confirm live provider prices on their checkout page." },
  { icon: BadgeCheck, title: "Verified Carrus listings", body: "Carrus reviews its own hosts and listings before they go live." },
  { icon: Car, title: "Know what is offered", body: "Each result says whether it is an exact vehicle or a similar class." },
];

function Row({ title, href, listings, trip }: { title: string; href: string; listings: VehicleListing[]; trip: { pickup: string; ret: string; location: string } }) {
  if (listings.length === 0) return null;
  return (
    <section>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-3xl font-bold text-gray-900">{title}</h2>
        <Link href={href} className="inline-flex shrink-0 items-center gap-1.5 text-[0.95rem] font-bold text-brand hover:text-brand-dark">
          View all <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {listings.slice(0, 3).map((l) => (
          <FeaturedCard key={l.id} listing={l} trip={trip} />
        ))}
      </ul>
    </section>
  );
}

export default async function HomePage() {
  const connectedSources = parsePartnerFeedConfig(process.env.PARTNER_FEEDS_JSON).map((feed) => feed.name);
  const dates = defaultTrip();
  const db = await createClient();
  const rows = await listPublishedRows(db, 24);
  const pickupAt = zonedLocalToUtc(dates.pickup, TZ)!;
  const returnAt = zonedLocalToUtc(dates.return, TZ)!;
  const listings = rows.map((r) => toListing(r, pickupAt, returnAt)).sort((a, b) => Number(Boolean(b.photoUrl)) - Number(Boolean(a.photoUrl)));
  const place = listings[0]?.locationLabel ?? "San Jose, CA";
  const city = place.replace(/, CA$/, "");
  const trip = { pickup: dates.pickup, ret: dates.return, location: place };
  const searchHref = (extra: Record<string, string> = {}, location = place) =>
    `/search?${new URLSearchParams({ location, pickup: dates.pickup, return: dates.return, ...extra }).toString()}`;
  const suvs = listings.filter((l) => l.vehicleType === "SUV");
  const others = listings.filter((l) => l.vehicleType !== "SUV");
  const chips = [
    { label: "San Jose", href: searchHref({}, "San Jose, CA") },
    { label: "SJC airport", href: searchHref({}, "SJC") },
    { label: "SUVs", href: searchHref({ type: "SUV" }) },
    { label: "Sports cars", href: searchHref({ type: "Sports" }) },
    { label: "7+ seats", href: searchHref({ seats: "7" }) },
  ];

  return (
    <main className="flex-1">
      <section className="relative isolate">
        <Image src="/hero.jpg" alt="" fill priority sizes="100vw" className="-z-10 object-cover" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-[rgba(5,8,18,0.86)] to-[rgba(5,8,18,0.3)]" />
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pb-20 sm:pt-24">
          <h1 className="text-5xl font-bold leading-[1.05] text-white sm:text-7xl">Find your next drive.</h1>
          <p className="mt-5 max-w-xl text-xl text-gray-200">
            Compare Carrus vehicles and connected rental offers with upfront pricing and clear booking details.
          </p>
          <div id="search" className="mt-9 scroll-mt-28">
            <h2 className="sr-only">Search vehicles</h2>
            <SearchForm defaults={dates} />
          </div>
          <ul className="mt-5 flex flex-wrap gap-2.5" aria-label="Quick searches">
            {chips.map((c) => (
              <li key={c.label}>
                <Link
                  href={c.href}
                  className="inline-block rounded-lg border border-gray-200 bg-white px-4 py-2 text-[0.9rem] text-gray-900 hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-12 sm:px-6">
        <SourcesMarquee connectedSources={connectedSources} />

        <section aria-labelledby="how-heading">
          <h2 id="how-heading" className="text-3xl font-bold text-gray-900">How Carrus works</h2>
          <ul className="mt-5 grid gap-5 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, body }) => (
              <li key={title} className={`${cardCls} p-6`}>
                <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <Icon className="size-6" aria-hidden />
                </span>
                <h3 className="mt-4 text-xl font-bold text-gray-900">{title}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-gray-600">{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <Row title={`Rentals in ${city}`} href={searchHref()} listings={others} trip={trip} />
        <Row title={`SUV rentals in ${city}`} href={searchHref({ type: "SUV" })} listings={suvs} trip={trip} />

        <ul className="grid gap-5 md:grid-cols-3">
          {PROMISES.map(({ icon: Icon, title, body }) => (
            <li key={title} className={`${cardCls} flex items-center gap-4 p-5`}>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                <p className="text-sm text-gray-600">{body}</p>
              </div>
            </li>
          ))}
        </ul>

        <section aria-labelledby="fleet-heading" className="flex flex-col gap-6 rounded-2xl bg-night px-7 py-10 text-white sm:px-10 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[0.78rem] font-bold uppercase tracking-[0.14em] text-gray-400">Carrus fleet program</p>
            <h2 id="fleet-heading" className="mt-2 text-3xl font-bold sm:text-4xl">Have a car sitting idle? Put it to work.</h2>
            <p className="mt-2 text-gray-300">List a specific vehicle and reach renters who search by exact make and model.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Link href="/join-the-fleet#steps-heading" className={btnSecondary}>How it works</Link>
            <Link href="/join-the-fleet" className={btnPrimary}>Join the fleet</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
