import Image from "next/image";

/** Carrus wordmark supplied by the team (public/carrus-logo.png, transparent background). */
export function Logo({ className = "h-8 w-auto" }: { className?: string }) {
  return <Image src="/carrus-logo.png" alt="Carrus" width={688} height={160} priority unoptimized className={className} />;
}

const PAINT: Record<string, string> = {
  silver: "#cbd5e1",
  gray: "#94a3b8",
  grey: "#94a3b8",
  white: "#f1f5f9",
  black: "#1e293b",
  blue: "#3b82f6",
  red: "#ef4444",
  green: "#4d7c5a",
};

/** Generic illustration used only when a listing has no photo. */
export function VehicleArt({ type, color, className = "" }: { type: string; color: string; className?: string }) {
  const paint = PAINT[color.trim().toLowerCase()] ?? "#c7d2fe";
  const tall = type === "SUV" || type === "Minivan" || type === "Van";
  const truck = type === "Truck";
  const body = truck
    ? "M14 62 L14 44 L58 44 L64 28 L104 28 L118 46 L146 50 L146 62 Z"
    : tall
      ? "M14 62 L16 40 L30 24 L112 24 L130 42 L146 48 L146 62 Z"
      : "M14 62 L18 46 L44 44 L60 30 L104 30 L124 44 L146 50 L146 62 Z";
  return (
    <svg viewBox="0 0 160 84" className={className} role="img" aria-label={`Illustration of a ${color ? `${color.toLowerCase()} ` : ""}${type.toLowerCase()} (no photo yet)`}>
      <rect width="160" height="84" fill="#eef1f6" />
      <path d={body} fill={paint} stroke="#334155" strokeWidth="2" strokeLinejoin="round" />
      <path d={truck ? "M68 32 L100 32 L110 44 L64 44 Z" : tall ? "M34 28 L108 28 L122 42 L22 42 Z" : "M62 34 L102 34 L116 44 L48 44 Z"} fill="#e0f2fe" stroke="#334155" strokeWidth="1.5" />
      <circle cx="44" cy="63" r="10" fill="#1e293b" />
      <circle cx="44" cy="63" r="4" fill="#cbd5e1" />
      <circle cx="118" cy="63" r="10" fill="#1e293b" />
      <circle cx="118" cy="63" r="4" fill="#cbd5e1" />
    </svg>
  );
}

/**
 * A listing's primary photo, cropped to the frame given by `className`
 * (which should set width and aspect ratio). Falls back to the illustration.
 */
export function VehicleImage({
  photoUrl,
  name,
  type,
  color,
  className = "aspect-[3/2] w-full",
  sizes = "(min-width: 1024px) 33vw, 100vw",
  priority,
}: {
  photoUrl?: string | null;
  name: string;
  type: string;
  color: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-lg bg-gray-100 ${className}`}>
      {photoUrl ? (
        <Image src={photoUrl} alt={`${name}${color ? `, ${color.toLowerCase()}` : ""}`} fill sizes={sizes} priority={priority} unoptimized={photoUrl.startsWith("https://")} className="object-cover" />
      ) : (
        <VehicleArt type={type} color={color} className="absolute inset-0 size-full" />
      )}
    </div>
  );
}
