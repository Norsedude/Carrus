import type { Metadata } from "next";
import { Cardo } from "next/font/google";
import Link from "next/link";
import { CarFront } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand";
import { CompareNavLink } from "@/components/compare";
import { NavLink } from "@/components/nav-link";
import { getSessionUser } from "@/lib/auth/session";
import "./globals.css";

// Cardo is the single typeface for the whole site (regular, italic, bold).
const cardo = Cardo({ variable: "--font-cardo", subsets: ["latin"], weight: ["400", "700"], style: ["normal", "italic"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Carrus: find your next drive", template: "%s | Carrus" },
  description: "Search, compare and reserve one specific rental vehicle with the full price shown up front. Class project prototype.",
};

const navLink =
  "rounded-md px-1 py-1 text-[1.02rem] text-gray-900 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand";
const navActive = "font-bold text-brand";

async function Header() {
  const user = await getSessionUser();
  const isPartner = user?.roles.includes("partner");
  const firstName = (user?.displayName || user?.email || "").replace(/\s*\(.*\)$/, "").split(/[\s@]/)[0];
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 sm:px-6 lg:h-[4.5rem] lg:py-0">
        <Link href="/" className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand" aria-label="Carrus home">
          <Logo className="h-8 w-auto" />
        </Link>
        <nav aria-label="Main" className="order-3 flex w-full flex-wrap items-center gap-x-6 gap-y-1 sm:order-none sm:w-auto sm:flex-1">
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
        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/join-the-fleet"
            className="hidden items-center gap-1.5 rounded-full border-[1.5px] border-brand px-3.5 py-1.5 text-[0.9rem] font-bold text-brand hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand min-[420px]:inline-flex"
          >
            <CarFront className="size-4" aria-hidden />
            List your car
          </Link>
          {user ? (
            <Link href="/account" className="flex items-center gap-2.5 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" aria-label="Account">
              <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-brand-soft text-base font-bold text-brand">
                {(firstName[0] ?? "A").toUpperCase()}
              </span>
              <span aria-hidden className="hidden text-[0.95rem] text-gray-900 md:inline">{firstName}</span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-[0.95rem] font-bold text-gray-900 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
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
  return (
    <footer className="mt-16 border-t border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-2 px-4 py-6 text-sm text-gray-500 sm:px-6">
        <p className="tracking-wide">© CARRUS 2026</p>
        <p className="flex flex-wrap gap-x-6 gap-y-1">
          <Link href="/#search" className="hover:text-gray-900">Search</Link>
          <Link href="/compare" className="hover:text-gray-900">Compare</Link>
          <Link href="/trips" className="hover:text-gray-900">Trips</Link>
          <Link href="/join-the-fleet" className="hover:text-gray-900">Join the fleet</Link>
        </p>
        <p className="w-full text-xs text-gray-500">
          Class prototype (CMPE 131, San José State University). Vehicles, hosts and payments are demonstration data. No real
          rentals are offered and no money moves.
        </p>
      </div>
    </footer>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${cardo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:shadow">
          Skip to content
        </a>
        <Header />
        <div id="main" className="flex min-w-0 flex-1 flex-col">
          {children}
        </div>
        <Footer />
      </body>
    </html>
  );
}
