"use client";

import { PanelLeftClose, PanelLeftOpen, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

const KEY = "carrus.filters.collapsed";

/**
 * Filters container. Desktop: a sticky sidebar that collapses to a slim rail
 * (remembered per browser). Mobile: an off-canvas drawer opened from a
 * "Filters" button. The filter form is rendered once and shared by both.
 */
const EVENT = "carrus-filters-collapsed";
function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false; // storage unavailable: keep expanded
  }
}
function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
}

export function FilterSidebar({ activeCount, children }: { activeCount: number; children: ReactNode }) {
  // Server render is always expanded; the saved desktop state applies after hydration.
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  function toggleCollapsed() {
    try {
      window.localStorage.setItem(KEY, collapsed ? "0" : "1");
    } catch {
      // ignore: storage unavailable
    }
    window.dispatchEvent(new Event(EVENT));
  }

  const count = activeCount > 0 && (
    <span className="inline-flex min-w-5 justify-center rounded-full bg-accent px-1.5 text-[0.7rem] font-bold text-accent-contrast">{activeCount}</span>
  );

  return (
    <>
      {/* Mobile trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 self-start rounded-full border border-gray-900 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-brand hover:text-brand-contrast lg:hidden"
        aria-expanded={open}
        aria-controls="filters-panel"
      >
        <SlidersHorizontal className="size-4" aria-hidden /> Filters {count}
      </button>

      {/* Mobile overlay */}
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-500 lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />

      <aside
        id="filters-panel"
        aria-label="Filters"
        data-collapsed={collapsed}
        className={[
          "fixed inset-y-0 left-0 z-50 w-[88%] max-w-sm overflow-y-auto border-r hairline bg-surface p-5 shadow-[var(--shadow-soft)]",
          "transition-[transform,width] duration-700 ease-[var(--ease-luxe)]",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:sticky lg:top-24 lg:z-auto lg:max-h-[calc(100vh-7rem)] lg:max-w-none lg:translate-x-0 lg:self-start lg:rounded-2xl lg:border lg:bg-white lg:shadow-none",
          collapsed ? "lg:w-16 lg:overflow-hidden lg:p-2.5" : "lg:w-[18rem]",
        ].join(" ")}
      >
        <div className={`flex items-center justify-between gap-2 border-b hairline pb-4 ${collapsed ? "lg:flex-col lg:border-b-0 lg:pb-0" : ""}`}>
          <h2 className={`flex items-center gap-2 font-display text-xl text-gray-900 ${collapsed ? "lg:sr-only" : ""}`}>
            <SlidersHorizontal className="size-5" aria-hidden /> Filters {count}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full p-2 text-gray-700 hover:bg-gray-100 lg:hidden"
            aria-label="Close filters"
          >
            <X className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="hidden rounded-full p-2 text-gray-700 hover:bg-gray-100 hover:text-gray-900 lg:inline-flex"
            aria-label={collapsed ? "Expand filters" : "Collapse filters"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand filters" : "Collapse filters"}
          >
            {collapsed ? <PanelLeftOpen className="size-5" aria-hidden /> : <PanelLeftClose className="size-5" aria-hidden />}
          </button>
          {collapsed && (
            <button type="button" onClick={toggleCollapsed} className="mt-2 hidden flex-col items-center gap-2 rounded-xl py-3 text-gray-700 hover:bg-gray-100 lg:flex" aria-hidden tabIndex={-1}>
              <SlidersHorizontal className="size-5" />
              {count}
              <span className="text-[0.62rem] font-medium uppercase tracking-[0.18em] [writing-mode:vertical-rl]">Filters</span>
            </button>
          )}
        </div>
        <div className={`pt-4 ${collapsed ? "lg:hidden" : ""}`}>{children}</div>
      </aside>
    </>
  );
}
