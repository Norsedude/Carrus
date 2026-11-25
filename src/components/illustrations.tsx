// Original line-art "clipart" for Carrus. Monochrome strokes in currentColor
// with a single accent fill, so every drawing follows the light/dark theme and
// the user's accent color. Decorative: hidden from assistive tech.

type Props = { className?: string };
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Winding road with a pickup pin: "search where you need a car". */
export function RoadArt({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden>
      <path d="M20 112 C 40 80, 110 92, 92 62 S 70 26, 128 10" {...stroke} strokeWidth={14} className="text-gray-200" />
      <path d="M20 112 C 40 80, 110 92, 92 62 S 70 26, 128 10" {...stroke} strokeDasharray="5 7" className="text-gray-500" />
      <circle cx="114" cy="44" r="14" fill="var(--c-accent-soft)" stroke="currentColor" strokeWidth={1.6} />
      <path d="M114 70 L104 50 a12 12 0 1 1 20 0 Z" fill="var(--c-accent)" />
      <circle cx="114" cy="42" r="4" fill="var(--c-card)" />
      <path d="M10 112 H150" {...stroke} className="text-gray-300" />
    </svg>
  );
}

/** Itemized receipt: "the real total, up front". */
export function ReceiptArt({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden>
      <path d="M48 10 H112 V110 L104 104 L96 110 L88 104 L80 110 L72 104 L64 110 L56 104 L48 110 Z" {...stroke} fill="var(--c-card)" fillOpacity={1} />
      <path d="M60 30 H100 M60 44 H92 M60 58 H96" {...stroke} className="text-gray-400" />
      <path d="M60 78 H100" {...stroke} />
      <rect x="60" y="84" width="40" height="10" rx="2" fill="var(--c-accent)" />
      <circle cx="122" cy="30" r="12" {...stroke} fill="var(--c-accent-soft)" />
      <path d="M117 30 l4 4 l7 -8" {...stroke} />
    </svg>
  );
}

/** Car key with tag: "reserve your exact car". */
export function KeyArt({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden>
      <rect x="30" y="34" width="42" height="56" rx="14" {...stroke} fill="var(--c-card)" />
      <circle cx="51" cy="52" r="6" fill="var(--c-accent)" />
      <path d="M44 70 H58 M44 78 H58" {...stroke} className="text-gray-400" />
      <path d="M72 62 H128 V72 H120 V80 H112 V72 H100" {...stroke} />
      <path d="M30 50 C 14 46, 12 22, 30 18 L44 22" {...stroke} className="text-gray-500" />
      <path d="M118 22 L140 30 L134 48 L112 40 Z" {...stroke} fill="var(--c-accent-soft)" />
      <circle cx="120" cy="30" r="2.5" fill="currentColor" />
    </svg>
  );
}

/** Car under a magnifier: empty search results. */
export function EmptySearchArt({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 200 120" className={className} aria-hidden>
      <path d="M10 98 H190" {...stroke} className="text-gray-300" />
      <path d="M30 92 L34 76 L60 72 L76 56 L120 56 L140 72 L162 76 L164 92 Z" {...stroke} fill="var(--c-card)" />
      <path d="M80 60 L116 60 L130 72 L70 72 Z" {...stroke} fill="var(--c-accent-soft)" />
      <circle cx="62" cy="94" r="9" fill="currentColor" />
      <circle cx="138" cy="94" r="9" fill="currentColor" />
      <circle cx="150" cy="34" r="20" {...stroke} fill="var(--c-card)" strokeWidth={2.2} />
      <path d="M164 48 L182 66" {...stroke} strokeWidth={5} />
      <path d="M143 34 h14" {...stroke} className="text-gray-400" />
    </svg>
  );
}

/** Garage door half open: partner / "list your car". */
export function GarageArt({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 200 140" className={className} aria-hidden>
      <path d="M20 60 L100 16 L180 60 V130 H20 Z" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
      <rect x="44" y="64" width="112" height="66" fill="var(--c-accent-soft)" stroke="currentColor" strokeWidth={1.6} />
      <path d="M44 76 H156 M44 88 H156" stroke="currentColor" strokeWidth={1.2} opacity={0.5} />
      <path d="M58 128 L62 114 L84 110 L96 100 L128 100 L140 110 L148 114 L150 128 Z" fill="var(--c-accent)" />
      <circle cx="78" cy="128" r="6" fill="currentColor" />
      <circle cx="132" cy="128" r="6" fill="currentColor" />
    </svg>
  );
}

/** Steering wheel badge: profile / account. */
export function WheelArt({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <circle cx="60" cy="60" r="46" {...stroke} fill="var(--c-accent-soft)" strokeWidth={2} />
      <circle cx="60" cy="60" r="34" {...stroke} className="text-gray-400" />
      <circle cx="60" cy="60" r="10" fill="var(--c-accent)" />
      <path d="M26 56 C 40 50, 50 52, 52 60 M94 56 C 80 50, 70 52, 68 60 M60 70 V94" {...stroke} strokeWidth={2.4} />
    </svg>
  );
}
