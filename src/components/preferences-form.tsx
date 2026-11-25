"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useActionState, useState, type ReactNode } from "react";
import { savePreferencesAction, type PreferencesState } from "@/app/actions/preferences";
import { applyTheme } from "@/components/theme-toggle";
import { Notice, btnPrimary, inputCls } from "@/components/ui";
import { ACCENTS, ACCENT_LABELS, type Preferences } from "@/lib/preferences";

const TYPES = ["Sedan", "SUV", "Sports", "Luxury", "Minivan", "Van", "Truck"] as const;

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="border-b hairline py-6 first:pt-0 last:border-b-0">
      <legend className="sr-only">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-[11rem_1fr]">
        <div>
          <p className="font-semibold text-gray-900">{title}</p>
          {hint && <p className="mt-0.5 text-sm text-gray-500">{hint}</p>}
        </div>
        <div>{children}</div>
      </div>
    </fieldset>
  );
}

/** Pill radio with a visible checked state. */
function Choice({ name, value, checked, onChange, children }: { name: string; value: string; checked: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <label className="cursor-pointer">
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="peer sr-only" />
      <span className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-700 transition-all duration-300 hover:border-gray-900 peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-contrast peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
        {children}
      </span>
    </label>
  );
}

/**
 * Display and search preferences. Theme, accent, density and motion preview
 * live as you pick them; Save stores everything for this browser.
 */
export function PreferencesForm({ initial, locations }: { initial: Preferences; locations: string[] }) {
  const [state, action, pending] = useActionState<PreferencesState, FormData>(savePreferencesAction, {});
  const [p, setP] = useState(initial);
  const set = <K extends keyof Preferences>(key: K, value: Preferences[K]) => setP((cur) => ({ ...cur, [key]: value }));
  const root = () => document.documentElement;

  return (
    <form action={action} className="space-y-2">
      {state.message && <Notice tone={state.saved ? "success" : "error"}>{state.message}</Notice>}

      <Group title="Theme" hint="Light, dark, or match your device.">
        <div className="grid grid-cols-3 gap-3">
          {([
            ["light", "Light", Sun, "#f3f3f1", "#1a1a1a"],
            ["dark", "Dark", Moon, "#121212", "#ececea"],
            ["system", "System", Monitor, "linear-gradient(135deg,#f3f3f1 50%,#121212 50%)", "#7a7a76"],
          ] as const).map(([value, label, Icon, bg, ink]) => (
            <label key={value} className="group cursor-pointer">
              <input
                type="radio"
                name="theme"
                value={value}
                checked={p.theme === value}
                onChange={() => {
                  set("theme", value);
                  applyTheme(value);
                }}
                className="peer sr-only"
              />
              <span className="block overflow-hidden rounded-2xl border border-gray-300 transition-all duration-300 group-hover:border-gray-900 peer-checked:border-accent peer-checked:ring-2 peer-checked:ring-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
                <span className="flex h-16 items-end gap-1.5 p-2.5" style={{ background: bg }}>
                  <span className="h-2 w-8 rounded-full" style={{ background: ink }} />
                  <span className="h-2 w-4 rounded-full opacity-50" style={{ background: ink }} />
                </span>
                <span className="flex items-center gap-2 px-3 py-2 text-sm text-gray-800">
                  <Icon className="size-4" aria-hidden /> {label}
                </span>
              </span>
            </label>
          ))}
        </div>
      </Group>

      <Group title="Accent" hint="Used for highlights and focus.">
        <div className="flex flex-wrap gap-3">
          {ACCENTS.map((a) => (
            <label key={a} className="group cursor-pointer text-center">
              <input
                type="radio"
                name="accent"
                value={a}
                checked={p.accent === a}
                onChange={() => {
                  set("accent", a);
                  root().dataset.accent = a;
                }}
                className="peer sr-only"
              />
              <span
                className="flex size-11 items-center justify-center rounded-full ring-offset-2 ring-offset-[var(--c-surface)] transition-transform duration-300 group-hover:scale-110 peer-checked:ring-2 peer-checked:ring-gray-900 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4"
                style={{ background: ACCENT_LABELS[a].swatch }}
              >
                {p.accent === a && <Check className="size-4 text-[#fafafa]" strokeWidth={3} aria-hidden />}
              </span>
              <span className="mt-1.5 block text-xs text-gray-600">{ACCENT_LABELS[a].label}</span>
            </label>
          ))}
        </div>
      </Group>

      <Group title="Layout" hint="Card spacing in results.">
        <div className="flex flex-wrap gap-2">
          {(["comfortable", "compact"] as const).map((d) => (
            <Choice key={d} name="density" value={d} checked={p.density === d} onChange={() => { set("density", d); root().dataset.density = d; }}>
              {d === "comfortable" ? "Comfortable" : "Compact"}
            </Choice>
          ))}
        </div>
      </Group>

      <Group title="Motion" hint="Fades and hover effects.">
        <div className="flex flex-wrap gap-2">
          {(["full", "reduced"] as const).map((m) => (
            <Choice key={m} name="motion" value={m} checked={p.motion === m} onChange={() => { set("motion", m); root().dataset.motion = m; }}>
              {m === "full" ? "Smooth" : "Reduced"}
            </Choice>
          ))}
        </div>
      </Group>

      <Group title="Search defaults" hint="Prefilled on the home page.">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm text-gray-700 sm:col-span-3">
            Home location
            <select name="homeLocation" value={p.homeLocation} onChange={(e) => set("homeLocation", e.target.value)} className={`${inputCls} mt-1.5`}>
              <option value="">No default</option>
              {locations.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-700">
            Radius (miles)
            <input name="radius" type="number" min={1} max={100} value={p.radius} onChange={(e) => set("radius", Number(e.target.value))} className={`${inputCls} mt-1.5`} />
          </label>
          <label className="text-sm text-gray-700">
            Min. seats
            <input name="minSeats" type="number" min={1} max={15} value={p.minSeats} onChange={(e) => set("minSeats", Number(e.target.value))} className={`${inputCls} mt-1.5`} />
          </label>
        </div>
        <p className="mb-2 mt-5 text-sm text-gray-700">Preferred types</p>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <label key={t} className="cursor-pointer">
              <input
                type="checkbox"
                name="types"
                value={t}
                checked={p.types.includes(t)}
                onChange={(e) => set("types", e.target.checked ? [...p.types, t] : p.types.filter((x) => x !== t))}
                className="peer sr-only"
              />
              <span className="inline-block rounded-full border border-gray-300 px-3.5 py-1.5 text-sm text-gray-700 transition-all duration-300 hover:border-gray-900 peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-contrast peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
                {t}
              </span>
            </label>
          ))}
        </div>
      </Group>

      <div className="flex items-center gap-4 pt-2">
        <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Saving…" : "Save preferences"}</button>
        <p className="text-xs text-gray-500">Saved on this device.</p>
      </div>
    </form>
  );
}
