# Carrus progress log

Compact state for resuming work. Update it whenever something lands.
Source brief: `CARRUS_HANDOFF.md` (supplied by Mateo in chat on 2026-11-14; not yet saved in the repo, see OPEN_QUESTIONS Q-11).

## Status as of 2026-11-14

Branch `feat/milestone-a` (local only, not pushed). Stack: Next.js 16 + local Supabase (see DECISIONS D-001).

Last full check run (2026-11-14): lint clean, typecheck clean, 46 unit tests, 24 integration tests, 13 browser tests, production build. All passed.

### Working (real code, covered by executed tests)

- **Accounts:** sign up, sign in, sign out, password reset by emailed link (local mail catcher), profile edit, session persists across reloads. Supabase Auth; no custom password handling.
- **Search:** database-backed, exact vehicles, location + dates + radius, filters (type, max daily rate, minimum seats, trip budget, make/model/year), sort, pagination, validation messages, loading and empty states, provider-failure states.
- **Vehicle details:** specs, partner and verification status, itemized price, conditional charges, cancellation policy, availability for chosen dates.
- **Compare:** up to three vehicles, same dates, itemized side by side, fresh availability on every load, stale vehicle cannot continue.
- **Booking:** server-priced quote, preconfirmation with no side effects, sign-in that keeps the selection, checkout, persisted reservation, confirmation page that only reads.
- **Integrity:** overlapping reservations are rejected by a database exclusion constraint; duplicate submits are idempotent; price change or expired quote blocks checkout; payment after hold expiry is refunded (simulated) instead of double-booking.
- **Authorization:** row-level security on every table; customers, partners and admins see only what they should; privileged changes go through database functions. Tested with two customers and two partners.
- **Partner:** Join the Fleet application, pending state with no privileges, dashboard (listings, reservations, out-on-rental count), add/edit listing, submit for review, pause/resume/archive.
- **Admin:** approve or reject partner applications and listings, audit log.
- **Customer Trips and partner Reservations** show the same persisted booking.

### Simulated or mock (clearly labeled in the UI)

- **Payments:** simulated adapter only. Accepts three demo test cards, stores no card data, moves no money.
- **Location search:** built-in list of ten Bay Area places, not a live geocoder.
- **External rental sources:** none integrated. A fictional "Demo rental source" adapter exists behind `PROVIDER_MODE=native+demo` (off by default) and cannot be booked.
- **Vehicle images:** generic illustrations tinted by color. Photo upload is not built.
- **Booked revenue** on the partner dashboard is a sum of simulated payments; no payout ledger.
- **Emails:** only Supabase Auth emails, caught locally by Mailpit. No booking notifications.

### Not built yet

- Milestone B remainder: listing photo upload and storage, multiple availability windows / calendar, request-to-book mode with partner approve/decline, searches/saved searches tables, notifications outbox, rate limiting, consistent JSON API routes (pages use server actions today).
- Milestone C: cancellation, inspections (pickup/return, photos), fee assessment, disputes, refunds, payout ledger, admin reports, Sanjay reservations #1001–#1011.
- Milestone D: hosting, hosted Supabase, Stripe sandbox, admin MFA.
- CI workflow file exists (`.github/workflows/ci.yml`) but has **never run**; it covers lint, typecheck, unit tests and build only.
- Mockup alignment: the Figma mockup (see below) was received after the UI was built. Current styling is the provisional default and does **not** match it yet.

## Design reference

Figma: https://www.figma.com/design/gxRoeLKXlItVR7nLMN3eWp/Carrus-Desktop-App?node-id=10-333 (page "Carrus v2", ~60 frames, desktop 1440 wide).
Observed: serif display type, wordmark with a mountain-shaped "A", royal-blue accent, photo-led cards, nav Search / Favorites / Trips / Inbox / More, "List your car" pill, avatar menu. The file defines no Figma variables, so tokens must be read per frame.
Key frame ids: Home 37:950, Search results 37:1634, All filters 37:2086, Compare 37:2377, Trips 37:2637, Account 37:2826, Sign in 37:3058, Join the fleet 37:3089, Fleet application 37:3268, Ford Explorer details/checkout/payment/confirmation/pickup 37:7119 / 37:7308 / 37:7475 / 37:7637 / 37:7756, Host dashboard 37:7851, Add listing 37:7994, Admin verification 37:8310, Components 18:333, Assets 10:334.
The mockup conflicts with the handoff in several places; see OPEN_QUESTIONS Q-12 to Q-16 before restyling.

## Next steps (proposed order)

1. Get answers to Q-12–Q-16, then restyle to the mockup screen by screen.
2. Listing photos (storage buckets + policies), availability calendar.
3. Request-to-book mode and partner approve/decline.
4. Milestone C trust workflow; seed Sanjay reservations.

## Environment notes

- Windows 11, Node 24, Docker Desktop (installed per-user under AppData). Docker must be running before `npm run db:start`.
- `next.config.ts` turns off Cache Components (D-004). Next 16 renamed middleware to `src/proxy.ts`.
- Very long shell commands fail on Windows; write large files with an editor/tool rather than heredocs.
