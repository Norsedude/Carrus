import Link from "next/link";
import { SearchForm } from "@/components/search-form";
import { SourcesMarquee } from "@/components/sources-marquee";
import { btnPrimary, cardCls } from "@/components/ui";
import { getNow } from "@/lib/clock";
import { DAY_MS, utcToZonedLocal } from "@/lib/time";

export const dynamic = "force-dynamic";

function defaultTrip() {
  const tz = "America/Los_Angeles";
  const tomorrow = utcToZonedLocal(new Date(getNow().getTime() + DAY_MS), tz).slice(0, 10);
  const later = utcToZonedLocal(new Date(getNow().getTime() + 4 * DAY_MS), tz).slice(0, 10);
  return { pickup: `${tomorrow}T10:00`, return: `${later}T10:00` };
}

const POINTS = [
  {
    title: "The exact car, not a category",
    body: "Each Carrus listing is one specific vehicle: make, model, year and color. When a source can only promise something similar, the listing says so.",
  },
  {
    title: "The full price before you commit",
    body: "Every mandatory fee is itemized in the total. Charges that depend on how the car comes back, such as cleaning or fuel, are listed separately with their amounts.",
  },
  {
    title: "Compare side by side",
    body: "Put up to three vehicles next to each other for the same dates and see seats, distance and itemized totals in one view.",
  },
];

export default function HomePage() {
  return (
    <main className="flex-1">
      <section className="bg-gradient-to-b from-blue-50 to-slate-50">
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-12 sm:px-6 sm:pt-16">
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Find the exact rental car that fits your trip.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-700">
            Search by place and dates, see the whole price up front, and reserve one specific vehicle.
          </p>
          <div id="search" className={`${cardCls} mt-8 scroll-mt-24 p-5`}>
            <h2 className="sr-only">Search vehicles</h2>
            <SearchForm defaults={defaultTrip()} />
            <p className="mt-3 text-xs text-slate-600">
              Location search uses a small built-in list of Bay Area cities and airports in this prototype.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="why-heading" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h2 id="why-heading" className="text-2xl font-bold text-slate-900">Why Carrus</h2>
        <ul className="mt-6 grid gap-4 md:grid-cols-3">
          {POINTS.map((p) => (
            <li key={p.title} className={`${cardCls} p-5`}>
              <h3 className="text-base font-semibold text-slate-900">{p.title}</h3>
              <p className="mt-2 text-sm text-slate-700">{p.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <SourcesMarquee />

      <section aria-labelledby="fleet-heading" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className={`${cardCls} flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between`}>
          <div>
            <h2 id="fleet-heading" className="text-xl font-bold text-slate-900">Have a vehicle to rent out? Join the Fleet.</h2>
            <p className="mt-1 text-sm text-slate-700">
              Individual owners and rental companies can apply to become verified Rental Partners and list specific vehicles.
            </p>
          </div>
          <Link href="/join-the-fleet" className={btnPrimary}>Join the Fleet</Link>
        </div>
      </section>
    </main>
  );
}
