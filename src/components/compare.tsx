"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { btnPrimary, btnSecondary } from "@/components/ui";

// Comparison list: up to three unique listing ids for one rental interval.
// Kept in localStorage because it is a per-browser convenience (no account
// data). The compare page itself is rendered on the server from the URL and
// always re-checks price and availability.

export const MAX_COMPARE = 3;
const KEY = "carrus.compare.v2";
const EVENT = "carrus-compare-change";

type CompareState = { ids: string[]; names: Record<string, string>; pickup: string; ret: string; location: string };
const EMPTY: CompareState = { ids: [], names: {}, pickup: "", ret: "", location: "" };
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
            ids: parsed.ids.filter((x) => typeof x === "string").slice(0, MAX_COMPARE),
            names: parsed.names && typeof parsed.names === "object" ? parsed.names : {},
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
  if (state.ids.length) params.set("ids", state.ids.join(","));
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
}: {
  id: string;
  name: string;
  pickup: string;
  ret: string;
  location: string;
  variant?: "inline" | "overlay";
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
    if (ids.length >= MAX_COMPARE) {
      setMessage(`You can compare up to ${MAX_COMPARE} vehicles. Remove one to add another.`);
      return;
    }
    write({ ids: [...ids, id], names: { ...(sameTrip ? state.names : {}), [id]: name }, pickup, ret, location });
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

/** Selection bar shown under search results once something is selected. */
export function CompareTray() {
  const state = useCompare();
  if (state.ids.length === 0) return null;
  return (
    <section aria-label="Vehicles selected to compare" className="sticky bottom-4 z-30 rounded-2xl bg-night p-4 text-snow shadow-[var(--shadow-soft)] page-enter" data-testid="compare-tray">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-bold">
            {state.ids.length} vehicle{state.ids.length === 1 ? "" : "s"} selected
          </p>
          <p className="text-sm text-snow/70">
            Compare up to {MAX_COMPARE} vehicles
            {state.ids.length < MAX_COMPARE ? ` · Add ${MAX_COMPARE - state.ids.length} more` : ""}
          </p>
        </div>
        <Link href={compareHref(state)} className={`${btnPrimary} !bg-snow !text-[#111] hover:!bg-[#ffffff]`}>
          Compare {state.ids.length} vehicle{state.ids.length === 1 ? "" : "s"}
        </Link>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {state.ids.map((id) => (
          <li key={id} className="flex items-center gap-2 rounded-full bg-snow/10 py-1.5 pl-3 pr-1.5 text-sm">
            {state.names[id] ?? "Selected vehicle"}
            <button
              type="button"
              onClick={() => write({ ...state, ids: state.ids.filter((x) => x !== id) })}
              className="rounded-full p-1 hover:bg-snow/15 focus-visible:outline-2 focus-visible:outline-snow"
              aria-label={`Remove ${state.names[id] ?? "vehicle"} from compare`}
            >
              <X className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
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
        const next = { ids: ids.filter((x) => x !== id), names: current.names, pickup, ret, location };
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
    if (nextIds.length > 0 && (current.ids.join(",") !== key || current.pickup !== pickup || current.ret !== ret)) {
      write({ ids: nextIds, names: { ...current.names, ...(JSON.parse(namesKey) as Record<string, string>) }, pickup, ret, location });
    }
  }, [key, namesKey, pickup, ret, location]);
  return null;
}
