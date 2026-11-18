# Carrus progress log

Compact state for resuming work. Update it whenever something lands.
Source brief: `CARRUS_HANDOFF.md` (supplied by Mateo in chat on 2026-11-14; not yet saved in the repo, see OPEN_QUESTIONS Q-11).

## Status as of 2026-11-14

### Partner feed connector (2026-11-21)

- Added an opt-in, server-side JSON feed adapter for authorized rental sources (`PARTNER_FEEDS_JSON`). It validates freshness, all-in USD price lines, allowed checkout/terms/photo hosts, and normalizes offers into search results. External cards show photos, descriptions, price breakdown, checkout and cancellation details, then link to the provider's checkout.
- No named rental company is connected; the home-page source names remain planned sources. The connector requires an approved feed endpoint and credentials. External offers cannot enter Carrus checkout, because no partner booking API is configured. See `docs/PARTNER_FEEDS.md`.
- Verified with lint, typecheck, 49 unit tests, and production build. The production build required network access to fetch the existing Cardo font.
- Added a separate external **demo checkout**: offer review, test-card validation, quote freshness and price recheck, simulated confirmation, original listing link, and demo history under Trips. Its records live in `external_demo_orders` and never create native bookings or provider reservations. Migration `20261121000001` is ready but could not be applied locally because Docker Desktop was not running during this work.
- `PROVIDER_MODE=native+demo` now supplies two fictional offers with complete example prices and links to Carrus-owned fictional source pages, so the demo checkout can be exercised locally without partner credentials. No outside company data is used.

Branch `feat/milestone-a` (local only, not pushed). Stack: Next.js 16 + local Supabase (see DECISIONS D-001).

Last full check run (2026-11-14, after the restyle): lint clean, typecheck clean, 46 unit tests, 24 integration tests, 13 browser tests, production build. All passed.

### Restyle (2026-11-14, second pass)

- Team logo (`public/carrus-logo.png`, from the PNG Mateo supplied), Cardo as the only typeface, colors from the Figma file (accent `#3f5efb`). Layout follows the mockup's structure for header, home, search results, vehicle details and compare; other pages inherit the tokens. Mateo said exact Figma fidelity is not required for now.
- Listings now show photos: six photos and the hero image were downloaded from the team's Figma file into `public/vehicles/` and `public/hero.jpg`, referenced through `vehicle_photos.storage_path`. Listings without a photo fall back to an illustration. Partner photo **upload** is still not built.
- `npm run seed:demo`: six original mock listings modeled on the mockup (Mustang, M2, 720S, Land Cruiser, Defender, Explorer) in San Jose, available for one year from the seed date. Nothing was scraped from other marketplaces (see DECISIONS D-020).
- Vehicle types now include Sports and Luxury (migration `20261114000002`).
- Wording aligned to the test plan: "N vehicles found", "No vehicles match your filters", "Max price per day", "Est. total", "Base rate (4 days × $68) / Protection / Taxes and fees / Trip total", "Mandatory fees / Estimated taxes" for the flat-fee policy, "Your card was declined."
- Home page strip shows the nine company names from the presentation as plain wordmarks with a "not connected or affiliated" note (D-019 revised).
- Favorites, Inbox, Help, Save search, Share, ratings and trip counts from the mockup are **not built** and not shown.

### F6 pickup condition check (2026-11-17, branch `feat/f6-pickup-inspection`)

- Partner: "Prepare vehicle" on a confirmed reservation, with "Vehicle is clean" and "Fuel level is Full", then "Confirm ready" (state becomes Ready for pickup, `bookings.ready_at` saved, audit event).
- Customer: "Start condition check" on a ready trip opens `/trips/[id]/pickup-check`: exterior damage, fuel level, cleanliness, one photo each for exterior, fuel gauge and interior, and an acknowledgment. Saving moves the reservation to Active. Both the trip page and the partner reservation page show the saved record with timestamped photos.
- Database: migration `20261125000001_pickup_inspections.sql` (tables `inspections` and `inspection_photos`, private bucket `inspection-photos`, functions `mark_ready_for_pickup` and `record_pickup_inspection`). The return inspection (F7) reuses the same tables with stage `return`.
- `npm run seed:sanjay` now also creates reservations #1001 (confirmed), #1002 and #1003 (ready for pickup) on archived RAV4 test units, so search results are unchanged.
- Checked so far: lint, typecheck, 61 unit tests, production build, and the migration's functions and row-level security in an in-memory Postgres. **Not yet run:** `tests/integration/inspection.test.ts` and a browser pass, which need local Supabase in Docker.
- Server actions and the proxy accept bodies up to 32 MB (three 10 MB photos) in `next.config.ts`.

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
- **External rental sources:** none integrated. A fictional "Demo rental source" adapter exists behind `PROVIDER_MODE=native+demo` (off by default) and supports only simulated checkout.
- **Vehicle images:** generic illustrations tinted by color. Photo upload is not built.
- **Booked revenue** on the partner dashboard is a sum of simulated payments; no payout ledger.
- **Emails:** only Supabase Auth emails, caught locally by Mailpit. No booking notifications.

### Not built yet

- Milestone B remainder: listing photo upload and storage, multiple availability windows / calendar, request-to-book mode with partner approve/decline, searches/saved searches tables, notifications outbox, rate limiting, consistent JSON API routes (pages use server actions today).
- Milestone C: cancellation, return inspection and fee assessment (F7), disputes (F8), refunds, payout ledger, admin reports, Sanjay reservations #1004–#1011. (Pickup inspection, F6, is built above.)
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
