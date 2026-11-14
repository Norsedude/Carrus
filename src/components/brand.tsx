// Replaceable vector branding (provisional, D-010). The wordmark is real SVG
// text plus a simple C-shaped route mark; swap this file to rebrand.
export function Logo({ className = "h-8 w-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 132 32" className={className} role="img" aria-label="Carrus">
      <path
        d="M24 7.5A11 11 0 1 0 24 24.5"
        fill="none"
        stroke="#1d4ed8"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="24" cy="7.5" r="3" fill="#0f172a" />
      <circle cx="24" cy="24.5" r="3" fill="#1d4ed8" />
      <text x="38" y="23" fontFamily="ui-sans-serif, system-ui, sans-serif" fontSize="21" fontWeight="700" fill="#0f172a" letterSpacing="-0.5">
        Carrus
      </text>
    </svg>
  );
}

const PAINT: Record<string, string> = {
  silver: "#cbd5e1",
  gray: "#94a3b8",
  grey: "#94a3b8",
  white: "#f1f5f9",
  black: "#1e293b",
  blue: "#3b82f6",
  red: "#ef4444",
  green: "#22c55e",
};

/**
 * Generic vehicle illustration tinted with the listing's color. It is an
 * illustration, not a photo of the actual vehicle; photo upload is not
 * implemented yet, and the UI says so wherever this appears large.
 */
export function VehicleArt({ type, color, className = "" }: { type: string; color: string; className?: string }) {
  const paint = PAINT[color.trim().toLowerCase()] ?? "#bfdbfe";
  const tall = type === "SUV" || type === "Minivan" || type === "Van";
  const truck = type === "Truck";
  const body = truck
    ? "M14 62 L14 44 L58 44 L64 28 L104 28 L118 46 L146 50 L146 62 Z"
    : tall
      ? "M14 62 L16 40 L30 24 L112 24 L130 42 L146 48 L146 62 Z"
      : "M14 62 L18 46 L44 44 L60 30 L104 30 L124 44 L146 50 L146 62 Z";
  return (
    <svg viewBox="0 0 160 84" className={className} role="img" aria-label={`Illustration of a ${color ? `${color.toLowerCase()} ` : ""}${type.toLowerCase()}`}>
      <rect width="160" height="84" rx="10" fill="#eef2f7" />
      <path d={body} fill={paint} stroke="#334155" strokeWidth="2" strokeLinejoin="round" />
      <path d={truck ? "M68 32 L100 32 L110 44 L64 44 Z" : tall ? "M34 28 L108 28 L122 42 L22 42 Z" : "M62 34 L102 34 L116 44 L48 44 Z"} fill="#e0f2fe" stroke="#334155" strokeWidth="1.5" />
      <circle cx="44" cy="63" r="10" fill="#1e293b" />
      <circle cx="44" cy="63" r="4" fill="#cbd5e1" />
      <circle cx="118" cy="63" r="10" fill="#1e293b" />
      <circle cx="118" cy="63" r="4" fill="#cbd5e1" />
    </svg>
  );
}
