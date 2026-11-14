"use client";

import { useState } from "react";
import { btnSecondary } from "@/components/ui";

// Rolling "sources" strip. These are illustrative categories, not partners:
// no external provider is integrated. Pausable, and static when the visitor
// prefers reduced motion.
const SOURCES = [
  "Airport rental counters",
  "Neighborhood rental offices",
  "Peer-to-peer hosts",
  "Independent local fleets",
  "Car-share operators",
  "Travel-site listings",
];

export function SourcesMarquee() {
  const [paused, setPaused] = useState(false);
  return (
    <section aria-labelledby="sources-heading" className="border-y border-slate-200 bg-white py-8">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 sm:px-6">
        <div>
          <h2 id="sources-heading" className="text-lg font-semibold text-slate-900">Demo rental sources</h2>
          <p className="text-sm text-slate-600">
            The kinds of sources Carrus is designed to bring together. None are connected yet; today every bookable vehicle
            comes from Carrus Rental Partners.
          </p>
        </div>
        <button type="button" className={btnSecondary} onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
          {paused ? "Resume scrolling" : "Pause scrolling"}
        </button>
      </div>
      <div className={`mt-5 overflow-hidden ${paused ? "marquee-paused" : ""}`}>
        <ul className="marquee-track flex w-max gap-3 px-4" aria-label="Demo rental source categories">
          {[...SOURCES, ...SOURCES].map((s, i) => (
            <li
              key={`${s}-${i}`}
              aria-hidden={i >= SOURCES.length}
              className="whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700"
            >
              {s}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
