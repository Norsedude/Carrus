"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useState, useTransition } from "react";
import { setThemeAction } from "@/app/actions/preferences";

type Theme = "light" | "dark" | "system";
const NEXT: Record<Theme, Theme> = { light: "dark", dark: "system", system: "light" };
const LABEL: Record<Theme, string> = { light: "Light", dark: "Dark", system: "System" };

/** Resolves and applies a theme preference to <html> immediately. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.themePref = theme;
  root.dataset.theme = theme === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme;
}

/** Header control: light → dark → system. Saved to the preferences cookie. */
export function ThemeToggle({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const [, startTransition] = useTransition();
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  return (
    <button
      type="button"
      onClick={() => {
        const next = NEXT[theme];
        setTheme(next);
        applyTheme(next);
        startTransition(() => setThemeAction(next));
      }}
      className="group inline-flex size-10 items-center justify-center rounded-full border border-gray-300 text-gray-900 hover:border-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2"
      aria-label={`Theme: ${LABEL[theme]}. Switch to ${LABEL[NEXT[theme]]}.`}
      title={`Theme: ${LABEL[theme]}`}
    >
      <Icon className="size-[1.1rem] transition-transform duration-700 ease-[var(--ease-luxe)] group-hover:rotate-45" aria-hidden />
    </button>
  );
}

