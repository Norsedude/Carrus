import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand";
import { CompareNavLink } from "@/components/compare";
import { getSessionUser } from "@/lib/auth/session";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Carrus: find the exact rental car for your trip", template: "%s | Carrus" },
  description:
    "Search, compare and book a specific rental vehicle with the full price shown up front. Class project prototype.",
};

const navLink =
  "rounded-md px-2.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-700";

async function Header() {
  const user = await getSessionUser();
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3 sm:px-6">
        <Link href="/" className="mr-2 rounded-md focus-visible:outline-2 focus-visible:outline-blue-700" aria-label="Carrus home">
          <Logo />
        </Link>
        <nav aria-label="Main" className="order-3 -mx-2 flex w-full flex-wrap items-center gap-1 sm:order-none sm:mx-0 sm:w-auto sm:flex-1">
          <Link href="/#search" className={navLink}>
            Search
          </Link>
          <CompareNavLink className={navLink} />
          <Link href="/join-the-fleet" className={navLink}>
            Join the Fleet
          </Link>
          {user?.roles.includes("partner") && (
            <Link href="/partner" className={navLink}>
              Partner
            </Link>
          )}
          {user?.roles.includes("admin") && (
            <Link href="/admin" className={navLink}>
              Admin
            </Link>
          )}
        </nav>
        <Link
          href={user ? "/account" : "/login"}
          className="ml-auto inline-flex items-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-700"
        >
          {user ? "Account" : "Sign in"}
        </Link>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-12 border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl space-y-2 px-4 py-6 text-sm text-slate-600 sm:px-6">
        <p>
          <strong className="text-slate-800">Carrus is a class prototype</strong> (CMPE 131, San José State University). Vehicles,
          partners and payments shown here are demonstration data. No real rentals are offered and no money moves.
        </p>
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/#search" className="hover:underline">Search</Link>
          <Link href="/compare" className="hover:underline">Compare</Link>
          <Link href="/join-the-fleet" className="hover:underline">Join the Fleet</Link>
          <Link href="/trips" className="hover:underline">Trips</Link>
        </p>
      </div>
    </footer>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
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
