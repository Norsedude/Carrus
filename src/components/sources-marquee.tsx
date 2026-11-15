"use client";

import { Pause, Play } from "lucide-react";
import { useState } from "react";

// Rolling strip of the rental companies and marketplaces Carrus is designed
// to search (from the team's presentation and mockup). They are shown as
// plain wordmarks, not official logo artwork, and none is connected yet:
// every bookable vehicle today comes from Carrus Rental Partners. The note
// under the strip says so. Pausable; static when reduced motion is preferred.
const SOURCES: { name: string; className: string }[] = [
  { name: "Budget", className: "font-bold" },
  { name: "enterprise", className: "font-bold lowercase" },
  { name: "Hertz", className: "font-extrabold italic" },
  { name: "AVIS", className: "font-extrabold tracking-wide" },
  { name: "TURO", className: "font-extrabold tracking-widest" },
  { name: "zipcar", className: "font-bold lowercase" },
  { name: "KAYAK", className: "font-extrabold tracking-wide" },
  { name: "Expedia", className: "font-bold" },
  { name: "priceline", className: "font-bold lowercase" },
];

export function SourcesMarquee() {
  const [paused, setPaused] = useState(false);
  return (
    <section aria-labelledby="sources-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="sources-heading" className="text-[0.78rem] font-bold uppercase tracking-[0.14em] text-gray-500">
          One search across rental companies and peer-to-peer hosts
        </h2>
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-gray-600 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-brand motion-reduce:hidden"
        >
          {paused ? <Play className="size-3.5" aria-hidden /> : <Pause className="size-3.5" aria-hidden />}
          {paused ? "Resume" : "Pause"}
        </button>
      </div>
      <div className={`mt-5 overflow-hidden ${paused ? "marquee-paused" : ""}`}>
        <ul className="marquee-track flex w-max items-center gap-20 pr-20" aria-label="Rental sources Carrus is designed to search">
          {[...SOURCES, ...SOURCES].map((s, i) => (
            <li
              key={`${s.name}-${i}`}
              aria-hidden={i >= SOURCES.length}
              className={`whitespace-nowrap text-[1.7rem] text-gray-400 [font-family:ui-sans-serif,system-ui,Helvetica,Arial,sans-serif] ${s.className}`}
            >
              {s.name}
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-4 text-sm text-gray-500">
        Planned sources. This prototype is not connected to or affiliated with these companies yet; vehicles shown come from
        Carrus Rental Partners.
      </p>
    </section>
  );
}
