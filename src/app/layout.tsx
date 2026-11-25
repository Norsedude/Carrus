import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, CarFront } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand";
import { CompareNavLink } from "@/components/compare";
import { NavLink } from "@/components/nav-link";
import { ThemeToggle } from "@/components/theme-toggle";
import { THEME_BOOT_SCRIPT } from "@/lib/theme-script";
import { getSessionUser } from "@/lib/auth/session";
import { getPreferences } from "@/lib/preferences";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Carrus: find your next drive", template: "%s | Carrus" },
  description: "Search, compare and reserve one specific rental vehicle with the full price shown up front. Class project prototype.",
};

// Clash Display + Satoshi are free fonts from Fontshare (ITF Free Font License).
const FONTS_CSS = "https://api.fontshare.com/v2/css?f[]=clash-display@500,600,700&f[]=satoshi@400,500,700&display=swap";

const navLink =
  "relative py-1 text-[0.95rem] font-medium text-gray-600 hover:text-gray-900 " +
  "after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-accent after:transition-transform after:duration-500 after:ease-[var(--ease-luxe)] hover:after:scale-x-100 " +
  "focus-visible:outline-2 focus-visible:outline-offset-4";
const navActive = "text-gray-900 after:scale-x-100";

async function Header({ theme }: { theme: "light" | "dark" | "system" }) {
  const user = await getSessionUser();
  const isPartner = user?.roles.includes("partner");
  const firstName = (user?.displayName || user?.email || "").replace(/\s*\(.*\)$/, "").split(/[\s@]/)[0];
  return (
    <header className="sticky top-0 z-40 border-b hairline bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-10 gap-y-3 px-4 py-3 sm:px-6 lg:h-[4.75rem] lg:py-0">
        <Link href="/" className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4" aria-label="Carrus home">
          <Logo className="logo-invert h-7 w-auto" />
        </Link>
        <nav aria-label="Main" className="order-3 flex w-full flex-wrap items-center gap-x-7 gap-y-1 sm:order-none sm:w-auto sm:flex-1">
          <NavLink href="/#search" match={["/", "/search", "/vehicles", "/booking", "/checkout"]} className={navLink} activeClassName={navActive}>
            Search
          </NavLink>
          <CompareNavLink className={navLink} activeClassName={navActive} />
          <NavLink href="/trips" match={["/trips", "/bookings"]} className={navLink} activeClassName={navActive}>
            Trips
          </NavLink>
          {isPartner && (
            <NavLink href="/partner" match={["/partner"]} className={navLink} activeClassName={navActive}>
              Partner
            </NavLink>
          )}
          {user?.roles.includes("admin") && (
            <NavLink href="/admin" match={["/admin"]} className={navLink} activeClassName={navActive}>
              Admin
            </NavLink>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2.5">
          <ThemeToggle initial={theme} />
          <Link
            href="/join-the-fleet"
            className="hidden items-center gap-2 rounded-full border border-gray-900 px-4 py-2 text-[0.9rem] font-medium text-gray-900 hover:bg-brand hover:text-brand-contrast focus-visible:outline-2 focus-visible:outline-offset-2 min-[460px]:inline-flex"
          >
            <CarFront className="size-4" aria-hidden />
            List your car
          </Link>
          {user ? (
            <Link href="/account" className="group flex items-center gap-2.5 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2" aria-label="Account">
              <span aria-hidden className="flex size-10 items-center justify-center rounded-full bg-brand font-display text-base font-semibold text-brand-contrast transition-transform duration-500 group-hover:scale-105">
                {(firstName[0] ?? "A").toUpperCase()}
              </span>
              <span aria-hidden className="hidden text-[0.9rem] text-gray-900 md:inline">{firstName}</span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-brand px-5 py-2 text-[0.9rem] font-medium text-brand-contrast hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function Footer() {
  const links = [
    { href: "/#search", label: "Search" },
    { href: "/compare", label: "Compare" },
    { href: "/trips", label: "Trips" },
    { href: "/account", label: "Account" },
    { href: "/join-the-fleet", label: "Join the fleet" },
  ];
  return (
    <footer className="mt-24 bg-night text-snow">
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-10">
          <div>
            <p className="text-sm text-snow/60">Find your next drive</p>
            <p className="mt-3 font-display text-6xl font-semibold leading-none tracking-[-0.05em] sm:text-8xl">CARRUS</p>
          </div>
          <ul className="grid grid-cols-2 gap-x-12 gap-y-3 text-[0.95rem]">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="group inline-flex items-center gap-1.5 text-snow/80 hover:text-snow">
                  {l.label}
                  <ArrowUpRight className="size-3.5 opacity-0 transition-all duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-14 flex flex-wrap justify-between gap-4 border-t border-snow/15 pt-6 text-xs text-snow/60">
          <p className="tracking-[0.16em]">© CARRUS 2026</p>
          <p className="max-w-2xl">
            Class prototype (CMPE 131, San José State University). Vehicles, hosts and payments are demonstration data. No real
            rentals are offered and no money moves.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const prefs = await getPreferences();
  return (
    <html
      lang="en"
      className="h-full antialiased"
      data-theme={prefs.theme === "dark" ? "dark" : "light"}
      data-theme-pref={prefs.theme}
      data-accent={prefs.accent}
      data-density={prefs.density}
      data-motion={prefs.motion}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONTS_CSS} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:shadow">
          Skip to content
        </a>
        <Header theme={prefs.theme} />
        <div id="main" className="flex min-w-0 flex-1 flex-col">
          {children}
        </div>
        <Footer />
      </body>
    </html>
  );
}
