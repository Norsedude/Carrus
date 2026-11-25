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

export function SourcesMarquee({ connectedSources = [] }: { connectedSources?: string[] }) {
  const [paused, setPaused] = useState(false);
  return (
    <section aria-labelledby="sources-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="sources-heading" className="text-sm font-medium text-gray-500">
          Built to search them all
        </h2>
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-gray-600 hover:text-gray-900 focus-visible:outline-2 motion-reduce:hidden"
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
              className={`whitespace-nowrap text-[1.6rem] text-gray-300 transition-colors duration-500 hover:text-gray-700 [font-family:ui-sans-serif,system-ui,Helvetica,Arial,sans-serif] ${s.className}`}
            >
              {s.name}
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-4 text-xs text-gray-500">
        {connectedSources.length > 0 ? `Connected: ${connectedSources.join(", ")}.` : "Planned sources. Not affiliated or connected yet."}
      </p>
    </section>
  );
}
