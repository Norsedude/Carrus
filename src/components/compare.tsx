"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { btnSecondary } from "@/components/ui";

// Comparison list: up to three unique listing ids for one rental interval.
// Kept in localStorage because it is a per-browser convenience (no account
// data). The compare page itself is rendered on the server from the URL and
// always re-checks price and availability.

export const MAX_COMPARE = 3;
const KEY = "carrus.compare.v1";
const EVENT = "carrus-compare-change";

type CompareState = { ids: string[]; pickup: string; ret: string; location: string };
const EMPTY: CompareState = { ids: [], pickup: "", ret: "", location: "" };
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
    cachedState = parsed && Array.isArray(parsed.ids)
      ? { ids: parsed.ids.filter((x) => typeof x === "string").slice(0, MAX_COMPARE), pickup: parsed.pickup ?? "", ret: parsed.ret ?? "", location: parsed.location ?? "" }
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

export function compareHref(state: CompareState): string {
  const params = new URLSearchParams();
  if (state.ids.length) params.set("ids", state.ids.join(","));
  if (state.pickup) params.set("pickup", state.pickup);
  if (state.ret) params.set("return", state.ret);
  if (state.location) params.set("location", state.location);
  const qs = params.toString();
  return qs ? `/compare?${qs}` : "/compare";
}

/** Header link with the live count. */
export function CompareNavLink({ className }: { className: string }) {
  const state = useCompare();
  return (
    <Link href={compareHref(state)} className={className}>
      Compare
      <span className="ml-1.5 inline-flex min-w-5 justify-center rounded-full bg-slate-900 px-1.5 text-xs font-semibold text-white" aria-label={`${state.ids.length} vehicles selected`}>
        {state.ids.length}
      </span>
    </Link>
  );
}

export function CompareToggle({ id, name, pickup, ret, location }: { id: string; name: string; pickup: string; ret: string; location: string }) {
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
    write({ ids: [...ids, id], pickup, ret, location });
  }

  return (
    <div>
      <button type="button" onClick={toggle} aria-pressed={selected} className={`${btnSecondary} w-full sm:w-auto`}>
        {selected ? "Remove from compare" : "Add to compare"}
        <span className="sr-only">: {name}</span>
      </button>
      <p role="status" className="mt-1 text-sm font-medium text-amber-800 empty:hidden">
        {message}
      </p>
    </div>
  );
}

/** On the compare page: remove a vehicle from both the saved list and the URL. */
export function CompareRemove({ id, name, ids, pickup, ret, location }: { id: string; name: string; ids: string[]; pickup: string; ret: string; location: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={btnSecondary}
      onClick={() => {
        const next = { ids: ids.filter((x) => x !== id), pickup, ret, location };
        write(next);
        router.push(compareHref(next));
      }}
    >
      Remove<span className="sr-only"> {name}</span>
    </button>
  );
}

/** Keeps the saved list in step with the ids the compare page actually rendered. */
export function CompareSync({ ids, pickup, ret, location }: { ids: string[]; pickup: string; ret: string; location: string }) {
  const key = ids.join(",");
  useEffect(() => {
    const current = read();
    const nextIds = key ? key.split(",") : [];
    if (nextIds.length > 0 && (current.ids.join(",") !== key || current.pickup !== pickup || current.ret !== ret)) {
      write({ ids: nextIds, pickup, ret, location });
    }
  }, [key, pickup, ret, location]);
  return null;
}
