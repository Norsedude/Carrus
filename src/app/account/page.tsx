import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, KeyRound, LogOut, Palette, ShieldCheck, UserRound } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { ProfileForm } from "@/components/auth-forms";
import { WheelArt } from "@/components/illustrations";
import { PreferencesForm } from "@/components/preferences-form";
import { Notice, btnSecondary, cardCls } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getNow } from "@/lib/clock";
import { getPreferences } from "@/lib/preferences";
import { createClient } from "@/lib/supabase/server";
import { KNOWN_LOCATIONS } from "@/server/search/location";

export const metadata: Metadata = { title: "Account" };

const SECTIONS = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "preferences", label: "Preferences", icon: Palette },
  { id: "access", label: "Access", icon: ShieldCheck },
  { id: "security", label: "Security", icon: KeyRound },
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className={`${cardCls} scroll-mt-28 p-6 sm:p-8`}>
      <h2 id={`${id}-heading`} className="text-2xl">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ notice?: string; denied?: string }> }) {
  const user = await requireUser("/account");
  const { notice, denied } = await searchParams;
  const db = await createClient();
  const [{ data: profile }, { data: partner }, { data: bookings }, prefs] = await Promise.all([
    db.from("profiles").select("display_name, phone").eq("id", user.id).maybeSingle(),
    db.from("partners").select("display_name, verification_status").eq("owner_user_id", user.id).maybeSingle(),
    db.from("bookings").select("return_at, state").eq("customer_id", user.id),
    getPreferences(),
  ]);
  const name = (profile?.display_name || user.email || "").replace(/ \((CUSTOMER|PARTNER)-\d+\)$/, "");
  const initials = name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "C";
  const now = getNow().getTime();
  const upcoming = (bookings ?? []).filter((b) => new Date(b.return_at).getTime() >= now && !["cancelled", "declined", "expired", "payment_failed"].includes(b.state)).length;
  const total = (bookings ?? []).length;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="sr-only">Account</h1>
      {(notice === "password-changed" || denied) && (
        <div className="mb-6 space-y-3">
          {notice === "password-changed" && <Notice tone="success">Your password was changed.</Notice>}
          {denied && <Notice tone="error">Your account does not have access to that page.</Notice>}
        </div>
      )}

      {/* Identity header */}
      <section className="relative overflow-hidden rounded-3xl bg-night p-7 text-snow sm:p-10">
        <WheelArt className="pointer-events-none absolute -right-6 -top-6 size-48 text-snow opacity-25 sm:size-64" />
        <div className="relative flex flex-wrap items-center gap-6">
          <span className="flex size-20 items-center justify-center rounded-full bg-snow font-display text-3xl font-semibold text-[#111] sm:size-24 sm:text-4xl">
            {initials}
          </span>
          <div className="min-w-0">
            <p className="font-display text-3xl font-medium sm:text-4xl">{name || "Your account"}</p>
            <p className="mt-1 text-snow/70" data-testid="account-email">{user.email}</p>
            <p className="mt-3 flex flex-wrap gap-1.5">
              {user.roles.map((r) => (
                <span key={r} className="rounded-full border border-snow/30 px-2.5 py-0.5 text-xs capitalize text-snow/85">{r}</span>
              ))}
            </p>
          </div>
        </div>
        <dl className="relative mt-8 grid max-w-md grid-cols-2 gap-px overflow-hidden rounded-2xl bg-snow/15">
          <div className="bg-night p-4">
            <dt className="text-xs text-snow/60">Upcoming trips</dt>
            <dd className="font-display text-3xl">{upcoming}</dd>
          </div>
          <div className="bg-night p-4">
            <dt className="text-xs text-snow/60">All bookings</dt>
            <dd className="font-display text-3xl">{total}</dd>
          </div>
        </dl>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[13rem_1fr]">
        <nav aria-label="Account sections" className="lg:sticky lg:top-24 lg:self-start">
          <ul className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <li key={id}>
                <a href={`#${id}`} className="flex items-center gap-2.5 whitespace-nowrap rounded-full px-4 py-2 text-sm text-gray-700 hover:bg-white hover:text-gray-900 lg:rounded-xl">
                  <Icon className="size-4" aria-hidden /> {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-6">
          <Section id="profile" title="Profile">
            <div className="max-w-md">
              <ProfileForm displayName={profile?.display_name ?? ""} phone={profile?.phone ?? ""} />
            </div>
          </Section>

          <Section id="preferences" title="Preferences">
            <PreferencesForm initial={prefs} locations={KNOWN_LOCATIONS.map((l) => l.label)} />
          </Section>

          <Section id="access" title="Access">
            <ul className="grid gap-3 sm:grid-cols-2">
              {[
                { href: "/trips", label: "My trips", show: true },
                partner
                  ? { href: partner.verification_status === "verified" ? "/partner" : "/join-the-fleet", label: `${partner.display_name} (${partner.verification_status})`, show: true }
                  : { href: "/join-the-fleet", label: "Become a rental partner", show: true },
                { href: "/admin", label: "Administration", show: user.roles.includes("admin") },
              ]
                .filter((l) => l.show)
                .map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="lift group flex items-center justify-between rounded-2xl border hairline px-5 py-4 text-gray-900">
                      {l.label}
                      <ArrowUpRight className="size-4 text-gray-400 transition-all duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gray-900" aria-hidden />
                    </Link>
                  </li>
                ))}
            </ul>
          </Section>

          <Section id="security" title="Security">
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/forgot-password" className={btnSecondary}>
                <KeyRound className="size-4" aria-hidden /> Reset password
              </Link>
              <form action={logoutAction}>
                <button type="submit" className={btnSecondary}>
                  <LogOut className="size-4" aria-hidden /> Sign out
                </button>
              </form>
            </div>
          </Section>
        </div>
      </div>
    </main>
  );
}
