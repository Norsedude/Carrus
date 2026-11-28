"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpRight, Check, Columns3, Link as LinkIcon, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Notice, btnPrimary, btnSecondary, inputCls } from "@/components/ui";

// Comparison list: up to three unique listing ids for one rental interval.
// Kept in localStorage because it is a per-browser convenience (no account
// data). The compare page itself is rendered on the server from the URL and
// always re-checks price and availability.

export const MAX_COMPARE = 3;
/** Listings pasted from other sites, on top of the search picks. */
export const MAX_LINKS = 2;
export const isLinkId = (id: string) => id.startsWith("link:");
const searchIds = (ids: string[]) => ids.filter((id) => !isLinkId(id));
const KEY = "carrus.compare.v2";
const EVENT = "carrus-compare-change";

/** What the search page already knows about a result, so it can be compared in place. */
export type CompareSnapshot = {
  name: string;
  photoUrl: string | null;
  year: number;
  type: string;
  seats: number;
  transmission: string;
  exact: boolean;
  demo: boolean;
  offeredBy: string;
  distanceMiles: number | null;
  dailyCents: number;
  totalCents: number;
  days: number;
  lines: { code: string; label: string; cents: number }[];
  href: string;
  external: boolean;
  /** Added from a pasted link: details come from that page or the user. */
  fromLink?: boolean;
  estimate?: boolean;
};

type CompareState = {
  ids: string[];
  names: Record<string, string>;
  items: Record<string, CompareSnapshot>;
  pickup: string;
  ret: string;
  location: string;
};
const EMPTY: CompareState = { ids: [], names: {}, items: {}, pickup: "", ret: "", location: "" };
let cachedRaw: string | null = null;
let cachedState: CompareState = EMPTY;

function read(): CompareState {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cachedRaw) return cachedState;
  cachedRaw = raw;
  try {
    const parsed = raw ? (JSON.parse(raw) as Partial<CompareState>) : null;
    cachedState =
      parsed && Array.isArray(parsed.ids)
        ? {
            ids: parsed.ids.filter((x) => typeof x === "string").slice(0, MAX_COMPARE + MAX_LINKS),
            names: parsed.names && typeof parsed.names === "object" ? parsed.names : {},
            items: parsed.items && typeof parsed.items === "object" ? parsed.items : {},
            pickup: parsed.pickup ?? "",
            ret: parsed.ret ?? "",
            location: parsed.location ?? "",
          }
        : EMPTY;
  } catch {
    cachedState = EMPTY;
  }
  return cachedState;
}

function write(next: CompareState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private mode): comparison simply does not persist.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function useCompare(): CompareState {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

type Trip = { ids: string[]; pickup: string; ret: string; location: string };

export function compareHref(state: Trip): string {
  const params = new URLSearchParams();
  // Pasted links live only in this browser, so the server page cannot load them.
  const ids = searchIds(state.ids);
  if (ids.length) params.set("ids", ids.join(","));
  if (state.pickup) params.set("pickup", state.pickup);
  if (state.ret) params.set("return", state.ret);
  if (state.location) params.set("location", state.location);
  const qs = params.toString();
  return qs ? `/compare?${qs}` : "/compare";
}

/** Header link with the live count. */
export function CompareNavLink({ className, activeClassName }: { className: string; activeClassName: string }) {
  const state = useCompare();
  const active = usePathname() === "/compare";
  return (
    <Link href={compareHref(state)} className={`${className} ${active ? activeClassName : ""}`} aria-current={active ? "page" : undefined}>
      Compare
      <span
        className="ml-1.5 inline-flex min-w-5 justify-center rounded-full bg-accent px-1.5 text-[0.68rem] font-bold tracking-normal text-accent-contrast transition-colors"
        aria-label={`${state.ids.length} vehicles selected`}
      >
        {state.ids.length}
      </span>
    </Link>
  );
}

/** "Compare" checkbox on a result card or vehicle page. */
export function CompareToggle({
  id,
  name,
  pickup,
  ret,
  location,
  variant = "inline",
  snapshot,
}: {
  id: string;
  name: string;
  pickup: string;
  ret: string;
  location: string;
  variant?: "inline" | "overlay";
  snapshot?: CompareSnapshot;
}) {
  const state = useCompare();
  const [message, setMessage] = useState("");
  const selected = state.ids.includes(id);

  function toggle() {
    setMessage("");
    if (selected) {
      write({ ...state, ids: state.ids.filter((x) => x !== id) });
      return;
    }
    // A comparison uses one rental interval: starting a new search resets it.
    const sameTrip = state.pickup === pickup && state.ret === ret;
    const ids = sameTrip ? state.ids : [];
    if (searchIds(ids).length >= MAX_COMPARE) {
      setMessage(`You can compare up to ${MAX_COMPARE} vehicles. Remove one to add another.`);
      return;
    }
    const items = { ...(sameTrip ? state.items : {}) };
    if (snapshot) items[id] = snapshot;
    write({ ids: [...ids, id], names: { ...(sameTrip ? state.names : {}), [id]: name }, items, pickup, ret, location });
  }

  const overlay = variant === "overlay";
  return (
    <div>
      <label
        className={[
          "inline-flex cursor-pointer select-none items-center gap-2 rounded-full text-sm transition-all duration-300",
          overlay ? "bg-[#fafafa]/90 px-3 py-1.5 text-[#111] shadow-sm backdrop-blur hover:bg-[#ffffff]" : "text-gray-800",
          selected ? "font-semibold" : "",
          selected && overlay ? "!bg-accent !text-accent-contrast" : "",
        ].join(" ")}
      >
        <span className="relative inline-flex size-[1.05rem]">
          <input
            type="checkbox"
            checked={selected}
            onChange={toggle}
            className={`peer size-full cursor-pointer appearance-none rounded-[5px] border-[1.5px] transition-colors duration-300 ${
              overlay ? "border-current checked:border-accent-contrast checked:bg-accent-contrast" : "border-gray-500 checked:border-accent checked:bg-accent"
            }`}
          />
          <Check
            aria-hidden
            strokeWidth={3}
            className={`pointer-events-none absolute inset-0 m-auto size-3 scale-50 opacity-0 transition-all duration-300 peer-checked:scale-100 peer-checked:opacity-100 ${overlay ? "text-accent" : "text-accent-contrast"}`}
          />
        </span>
        Compare
        <span className="sr-only"> {name}</span>
      </label>
      <p role="status" className={`mt-1 text-xs font-medium empty:hidden ${overlay ? "rounded-lg bg-[#fafafa]/95 px-2 py-1 text-[#6b5016]" : "text-amber-800"}`}>
        {message}
      </p>
    </div>
  );
}

/** Selection bar under search results: compare right here, or open the full page. */
export function CompareTray() {
  const state = useCompare();
  const [open, setOpen] = useState(false);
  if (state.ids.length === 0) return null;
  const remove = (id: string) => write({ ...state, ids: state.ids.filter((x) => x !== id) });
  return (
    <>
      <section aria-label="Vehicles selected to compare" className="sticky bottom-4 z-30 rounded-2xl bg-night p-4 text-snow shadow-[var(--shadow-soft)] page-enter" data-testid="compare-tray">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold">
              {state.ids.length} vehicle{state.ids.length === 1 ? "" : "s"} selected
            </p>
            <p className="text-sm text-snow/70">
              {state.ids.length < 2 ? "Pick at least one more to compare" : `Compare up to ${MAX_COMPARE}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <AddLinkButton trip={state} variant="dark" />
            <button
              type="button"
              onClick={() => setOpen(true)}
              disabled={state.ids.length < 2}
              className={`${btnPrimary} !bg-accent !text-accent-contrast hover:!brightness-110`}
            >
              <Columns3 className="size-4" aria-hidden /> Compare here
            </button>
            {searchIds(state.ids).length > 0 && (
              <Link href={compareHref(state)} className={`${btnSecondary} !border-snow/40 !text-snow hover:!border-snow hover:!bg-transparent`}>
                Compare {state.ids.length} vehicle{state.ids.length === 1 ? "" : "s"}
              </Link>
            )}
          </div>
        </div>
        <ul className="mt-3 flex flex-wrap gap-2">
          {state.ids.map((id) => (
            <li key={id} className="flex items-center gap-2 rounded-full bg-snow/10 py-1.5 pl-3 pr-1.5 text-sm">
              {isLinkId(id) && <LinkIcon className="size-3.5 opacity-70" aria-hidden />}
              {state.names[id] ?? "Selected vehicle"}
              <button
                type="button"
                onClick={() => remove(id)}
                className="rounded-full p-1 hover:bg-snow/15 focus-visible:outline-2 focus-visible:outline-snow"
                aria-label={`Remove ${state.names[id] ?? "vehicle"} from compare`}
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </section>
      {open && <CompareSheet state={state} onClose={() => setOpen(false)} onRemove={remove} />}
    </>
  );
}

const money = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** In-page side-by-side comparison built from the results already on screen. */
function CompareSheet({ state, onClose, onRemove }: { state: CompareState; onClose: () => void; onRemove: (id: string) => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  useEffect(() => {
    if (state.ids.length < 2) onClose();
  }, [state.ids.length, onClose]);

  const cols = state.ids.map((id) => ({ id, item: state.items[id] }));
  const known = cols.filter((c): c is { id: string; item: CompareSnapshot } => Boolean(c.item));
  const cheapest = Math.min(...known.map((c) => c.item.totalCents));
  const lineCodes = [...new Set(known.flatMap((c) => c.item.lines.map((l) => l.code)))];
  const rows: [string, (s: CompareSnapshot) => string][] = [
    ["Type", (s) => s.type],
    ["Seats", (s) => (s.seats ? String(s.seats) : "—")],
    ["Transmission", (s) => s.transmission],
    ["Match", (s) => (s.exact ? "Exact vehicle" : "Or similar")],
    ["Distance", (s) => (s.distanceMiles === null ? "—" : `${s.distanceMiles.toFixed(1)} mi`)],
    ["Offered by", (s) => s.offeredBy],
    ["Daily rate", (s) => money(s.dailyCents)],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="compare-sheet-title">
      <div aria-hidden onClick={onClose} className="page-enter absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
      <div className="sheet-in relative max-h-[92vh] w-full max-w-5xl overflow-auto rounded-t-3xl bg-surface p-5 shadow-[var(--shadow-soft)] sm:rounded-3xl sm:p-7" data-testid="compare-sheet">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="compare-sheet-title" className="text-3xl">Side by side</h2>
            <p className="mt-1 text-sm text-gray-500">Prices from your current search. The full comparison re-checks live prices.</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="rounded-full p-2 text-gray-700 hover:bg-gray-100" aria-label="Close comparison">
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm" style={{ minWidth: `${8 + cols.length * 12}rem` }}>
            <caption className="sr-only">Selected vehicles compared side by side</caption>
            <thead>
              <tr>
                <td className="w-32" />
                {cols.map(({ id, item }) => (
                  <th key={id} scope="col" className="p-3 text-left align-top" data-testid="sheet-column">
                    {item?.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.photoUrl} alt="" className="mb-3 aspect-[3/2] w-full rounded-xl object-cover" />
                    ) : (
                      <div className="mb-3 aspect-[3/2] w-full rounded-xl bg-accent-soft" />
                    )}
                    <p className="text-base font-semibold text-gray-900">{item ? `${item.year ? `${item.year} ` : ""}${item.name}` : state.names[id] ?? "Selected vehicle"}</p>
                    <p className="mt-1.5 flex flex-wrap gap-1.5">
                      {item && item.totalCents === cheapest && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[0.7rem] font-medium text-emerald-900">Lowest total</span>}
                      {item?.demo && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.7rem] font-medium text-amber-900">Demo</span>}
                      {item?.fromLink && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[0.7rem] font-medium text-accent">Your link</span>}
                      {item?.estimate && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[0.7rem] font-medium text-gray-700">Est. total</span>}
                    </p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, get]) => (
                <tr key={label} className="border-t hairline">
                  <th scope="row" className="p-3 text-left font-medium text-gray-500">{label}</th>
                  {cols.map(({ id, item }) => (
                    <td key={id} className="p-3 text-gray-900">{item ? get(item) : "—"}</td>
                  ))}
                </tr>
              ))}
              {lineCodes.map((code) => (
                <tr key={code} className="border-t hairline">
                  <th scope="row" className="p-3 text-left font-medium text-gray-500">
                    {known.map((c) => c.item.lines.find((l) => l.code === code)?.label).find(Boolean)}
                  </th>
                  {cols.map(({ id, item }) => {
                    const line = item?.lines.find((l) => l.code === code);
                    return <td key={id} className="p-3 tabular-nums text-gray-900">{line ? money(line.cents) : "—"}</td>;
                  })}
                </tr>
              ))}
              <tr className="border-t-2 border-gray-300 bg-accent-soft/60">
                <th scope="row" className="p-3 text-left font-semibold text-gray-900">Trip total</th>
                {cols.map(({ id, item }) => (
                  <td key={id} className="p-3 font-display text-xl font-semibold tabular-nums text-gray-900">{item ? money(item.totalCents) : "—"}</td>
                ))}
              </tr>
              <tr className="border-t hairline">
                <td />
                {cols.map(({ id, item }) => (
                  <td key={id} className="space-y-2 p-3 align-top">
                    {item && (
                      <a href={item.href} className={`${btnPrimary} w-full`} target={item.external ? "_blank" : undefined} rel={item.external ? "noopener noreferrer" : undefined}>
                        {item.fromLink ? "Open link" : item.external ? "View listing" : "View deal"} <ArrowUpRight className="size-4" aria-hidden />
                      </a>
                    )}
                    <button type="button" onClick={() => onRemove(id)} className={`${btnSecondary} w-full`}>
                      Remove<span className="sr-only"> {state.names[id]}</span>
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <AddLinkButton trip={state} />
          {searchIds(state.ids).length > 0 && (
            <Link href={compareHref(state)} className="text-sm font-medium text-gray-900 underline underline-offset-4 hover:text-accent">
              Open full comparison with live prices
            </Link>
          )}
        </div>
        {known.some((c) => c.item.fromLink) && (
          <p className="mt-3 text-xs text-gray-500">Details for pasted links come from that page and what you entered. Check the price on the site before booking.</p>
        )}
      </div>
    </div>
  );
}

/** On the compare page: remove a vehicle from both the saved list and the URL. */
export function CompareRemove({ id, name, ids, pickup, ret, location }: { id: string; name: string } & Trip) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={`${btnSecondary} w-full`}
      onClick={() => {
        const current = read();
        const next = { ids: [...ids.filter((x) => x !== id), ...current.ids.filter(isLinkId)], names: current.names, items: current.items, pickup, ret, location };
        write(next);
        router.push(compareHref(next));
      }}
    >
      Remove<span className="sr-only"> {name}</span>
    </button>
  );
}

/** Keeps the saved list in step with the ids the compare page actually rendered. */
export function CompareSync({ ids, names, pickup, ret, location }: Trip & { names: Record<string, string> }) {
  const key = ids.join(",");
  const namesKey = JSON.stringify(names);
  useEffect(() => {
    const current = read();
    const nextIds = key ? key.split(",") : [];
    const sameTrip = current.pickup === pickup && current.ret === ret;
    const links = sameTrip ? current.ids.filter(isLinkId) : [];
    if (nextIds.length > 0 && (searchIds(current.ids).join(",") !== key || !sameTrip)) {
      write({ ids: [...nextIds, ...links], names: { ...current.names, ...(JSON.parse(namesKey) as Record<string, string>) }, items: current.items, pickup, ret, location });
    }
  }, [key, namesKey, pickup, ret, location]);
  return null;
}

/** Shown above results until something is selected, so comparing is discoverable. */
export function CompareHint({ trip }: { trip: { pickup: string; ret: string; location: string } }) {
  const state = useCompare();
  if (state.ids.length > 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-accent/40 bg-accent-soft/50 px-4 py-3 text-sm text-gray-700">
      <p className="flex items-center gap-2.5">
        <Columns3 className="size-4 shrink-0 text-accent" aria-hidden />
        <span>
          Tick <span className="font-semibold text-gray-900">Compare</span> on up to {MAX_COMPARE} cars to see them side by side, right here.
        </span>
      </p>
      <AddLinkButton trip={{ ids: [], ...trip }} />
    </div>
  );
}

type LinkDetails = {
  url: string;
  site: string;
  title: string;
  imageUrl: string | null;
  make: string;
  model: string;
  year: number | null;
  vehicleType: string;
  seats: number | null;
  transmission: string;
  dailyCents: number | null;
  totalCents: number | null;
  found: string[];
};

function tripDays(pickup: string, ret: string): number {
  const ms = new Date(ret).getTime() - new Date(pickup).getTime();
  return Number.isFinite(ms) && ms > 0 ? Math.max(1, Math.ceil(ms / 86_400_000)) : 1;
}

/** "Add a link": paste a listing from another site and compare it with your picks. */
export function AddLinkButton({ trip, variant = "light" }: { trip: Trip; variant?: "light" | "dark" }) {
  const state = useCompare();
  const [open, setOpen] = useState(false);
  const linkCount = state.ids.filter(isLinkId).length;
  const disabled = linkCount >= MAX_LINKS;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={disabled ? `You can add up to ${MAX_LINKS} links` : undefined}
        className={
          variant === "dark"
            ? `${btnSecondary} !border-snow/40 !text-snow hover:!border-snow hover:!bg-transparent`
            : "inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:border-gray-900 disabled:opacity-50"
        }
      >
        <LinkIcon className="size-4" aria-hidden /> Add a link
      </button>
      {open && <AddLinkDialog trip={trip} onClose={() => setOpen(false)} />}
    </>
  );
}

function AddLinkDialog({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const state = useCompare();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [details, setDetails] = useState<LinkDetails | null>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const pickup = state.ids.length ? state.pickup : trip.pickup;
  const ret = state.ids.length ? state.ret : trip.ret;
  const days = tripDays(pickup, ret);

  useEffect(() => {
    urlRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function lookUp(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/link-preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      const body = (await res.json()) as { data?: LinkDetails; error?: { message: string } };
      if (body.data) setDetails(body.data);
      else {
        setError(body.error?.message ?? "We could not read that link.");
        // Still let the user type the details by hand.
        try {
          const u = new URL(url);
          setDetails({ url: u.toString(), site: u.hostname.replace(/^www\./, ""), title: "", imageUrl: null, make: "", model: "", year: null, vehicleType: "", seats: null, transmission: "", dailyCents: null, totalCents: null, found: [] });
        } catch {
          setDetails(null);
        }
      }
    } catch {
      setError("We could not reach Carrus. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!details) return;
    const f = new FormData(event.currentTarget);
    const val = (k: string) => String(f.get(k) ?? "").trim();
    const name = val("name") || details.title || details.site;
    const dollars = (k: string) => {
      const n = Number(val(k).replace(/[^0-9.]/g, ""));
      return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
    };
    const daily = dollars("daily");
    const totalInput = dollars("total");
    if (!daily && !totalInput) {
      setError("Enter the daily rate or the trip total so it can be compared.");
      return;
    }
    const total = totalInput ?? (daily as number) * days;
    const id = `link:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const snapshot: CompareSnapshot = {
      name,
      photoUrl: details.imageUrl,
      year: Number(val("year")) || details.year || 0,
      type: val("type") || details.vehicleType || "—",
      seats: Number(val("seats")) || details.seats || 0,
      transmission: details.transmission || "—",
      exact: false,
      demo: false,
      offeredBy: details.site,
      distanceMiles: null,
      dailyCents: daily ?? Math.round(total / days),
      totalCents: total,
      days,
      lines: [{ code: "link_total", label: totalInput ? "Total from the listing" : `${days} day${days === 1 ? "" : "s"} × daily rate (fees not included)`, cents: total }],
      href: details.url,
      external: true,
      fromLink: true,
      estimate: !totalInput,
    };
    const sameTrip = state.ids.length === 0 || (state.pickup === pickup && state.ret === ret);
    const base = sameTrip ? state : { ...state, ids: [], names: {}, items: {} };
    write({
      ids: [...base.ids, id],
      names: { ...base.names, [id]: name },
      items: { ...base.items, [id]: snapshot },
      pickup,
      ret,
      location: base.location || trip.location,
    });
    onClose();
  }

  const has = (k: string) => details?.found.includes(k);
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center text-gray-900 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="add-link-title">
      <div aria-hidden onClick={onClose} className="page-enter absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
      <div className="sheet-in relative max-h-[92vh] w-full max-w-lg overflow-auto rounded-t-3xl bg-surface p-6 shadow-[var(--shadow-soft)] sm:rounded-3xl" data-testid="add-link-dialog">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="add-link-title" className="text-2xl">Compare a listing from another site</h2>
            <p className="mt-1 text-sm text-gray-500">Paste a link. We read the page&apos;s public details; you can fix anything we miss.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-gray-700 hover:bg-gray-100" aria-label="Close">
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <form onSubmit={lookUp} className="mt-5 flex gap-2">
          <label htmlFor="link-url" className="sr-only">Listing link</label>
          <input ref={urlRef} id="link-url" type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className={`${inputCls} flex-1`} />
          <button type="submit" disabled={loading || !url} className={btnPrimary}>
            {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} {loading ? "Reading…" : "Look up"}
          </button>
        </form>
        {error && <div className="mt-3"><Notice tone="warning">{error}</Notice></div>}

        {details && (
          <form onSubmit={add} className="page-enter mt-5 space-y-4" key={details.url}>
            <div className="flex gap-4">
              {details.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={details.imageUrl} alt="" referrerPolicy="no-referrer" className="aspect-[4/3] w-28 shrink-0 rounded-xl object-cover" />
              ) : (
                <div className="flex aspect-[4/3] w-28 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><LinkIcon className="size-6" aria-hidden /></div>
              )}
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-gray-900">{details.site}</p>
                <p className="truncate text-gray-500">{details.url}</p>
                <p className="mt-1 text-xs text-gray-500">{details.found.length ? `Found: ${details.found.join(", ")}` : "No details found on the page; please fill them in."}</p>
              </div>
            </div>
            <label className="block text-sm text-gray-700">
              Car name
              <input name="name" defaultValue={[details.make, details.model].filter(Boolean).join(" ") || details.title} required maxLength={80} className={`${inputCls} mt-1`} />
            </label>
            <div className="grid grid-cols-3 gap-3">
              <label className="text-sm text-gray-700">Year<input name="year" inputMode="numeric" defaultValue={details.year ?? ""} className={`${inputCls} mt-1`} /></label>
              <label className="text-sm text-gray-700">Type<input name="type" defaultValue={details.vehicleType} placeholder="SUV" className={`${inputCls} mt-1`} /></label>
              <label className="text-sm text-gray-700">Seats<input name="seats" inputMode="numeric" defaultValue={details.seats ?? ""} className={`${inputCls} mt-1`} /></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm text-gray-700">
                Daily rate ($){has("dailyRate") && <span className="ml-1 text-xs text-accent">from page</span>}
                <input name="daily" inputMode="decimal" defaultValue={details.dailyCents ? (details.dailyCents / 100).toFixed(2) : ""} className={`${inputCls} mt-1`} />
              </label>
              <label className="text-sm text-gray-700">
                Trip total ($){has("total") && <span className="ml-1 text-xs text-accent">from page</span>}
                <input name="total" inputMode="decimal" defaultValue={details.totalCents ? (details.totalCents / 100).toFixed(2) : ""} placeholder={`or daily × ${days}`} className={`${inputCls} mt-1`} />
              </label>
            </div>
            <p className="text-xs text-gray-500">Your trip is {days} day{days === 1 ? "" : "s"}. Without a total we estimate daily rate × days, before fees.</p>
            <button type="submit" className={`${btnPrimary} w-full`}>Add to comparison</button>
          </form>
        )}
      </div>
    </div>
  );
}

/** On the full compare page: pasted links stay in this browser, so point to the in-page view. */
export function CompareLinksNote({ searchHref }: { searchHref: string }) {
  const state = useCompare();
  const links = state.ids.filter(isLinkId);
  if (links.length === 0) return null;
  return (
    <div className="mt-4">
      <Notice tone="info">
        You also pasted {links.length} link{links.length === 1 ? "" : "s"} ({links.map((id) => state.names[id]).filter(Boolean).join(", ")}). Pasted links are compared on the search page:{" "}
        <Link href={searchHref} className="font-medium underline underline-offset-4">open search</Link> and choose “Compare here”.
      </Notice>
    </div>
  );
}
