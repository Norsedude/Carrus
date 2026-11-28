# Carrus progress log

Compact state for resuming work. Update it whenever something lands.
Source brief: `CARRUS_HANDOFF.md` (supplied by Mateo in chat on 2026-11-14; not yet saved in the repo, see OPEN_QUESTIONS Q-11).

## Status as of 2026-11-27

### Milestone B complete (2026-11-27)

Migration `20261127000001_milestone_b.sql`. All features run against the database and are covered by executed tests.

- **Listing photos:** partners upload up to 8 JPG/PNG/WebP photos per listing on the edit page, choose the cover photo and remove photos. Files are checked by content (not name), limited to 10,000,000 bytes, downscaled in the browser and sent one per request (Vercel's 4.5 MB request cap), stored in the public `vehicle-photos` bucket. Vehicle pages show a photo gallery.
- **Availability:** listings can have up to 12 availability windows. Vehicle pages show a two-month calendar (available / booked / not offered, plus "your trip") from `vehicle_busy_periods`, which exposes busy times only, never customer details.
- **Request to book:** a listing's booking mode can be "Request to book". Checkout then creates a `pending_partner` reservation that holds the car for 24 hours; the partner approves or declines (optional reason) from the reservation page or the dashboard alert. Decline or no answer frees the car and refunds the simulated payment (`respond_to_booking`, `expire_pending_requests`, swept lazily on page loads).
- **Notifications outbox + Inbox:** booking confirmed / requested / approved / declined / expired and partner "new booking/request" messages are written in the same transaction as the booking change. Header bell with unread count, `/inbox`, mark all read. `email_status` is the outbox state; no email provider is wired yet.
- **Saved searches:** "Save search" on results (signed in), list and delete under Account, private by RLS, 20 per user.
- **Rate limiting:** Postgres fixed-window limiter (`hit_rate_limit`) on sign-in, sign-up, password reset, guest checkout, link import, saving searches and the JSON API. On in production (or `RATE_LIMIT_ENABLED=true`); off in local dev and tests.
- **JSON API:** `GET /api/search`, `GET /api/vehicles/:id`, `POST /api/link-preview`, one `{ data } | { error }` shape.
- **Compare a pasted link:** "Add a link" (search page hint, compare tray and side-by-side panel) fetches one public page on request and reads its Open Graph / schema.org metadata (title, photo, make/model/year, seats, price per day or total). Anything missing is typed by the user. The fetch blocks private/loopback/metadata addresses at connect time, allows only http(s) on standard ports, caps redirects, size and time, and does not get around logins, paywalls or bot blocks. Up to 2 links alongside up to 3 search results; links live in this browser only.

Fixes found while testing: extra availability rows reused the first row's input id (dates went into the wrong field); the footer "Account" link made the sign-in check pass before sign-in finished; partner cards lost the visible "Verified partner" text; the new e2e test for guest checkout now runs.

Merged with PR #2 (F6 pickup check) and fixed its review findings: dashboard "out on rental" for ready and active bookings, pickup form keeps input on errors, pickup photos downscaled to fit Vercel's 4.5 MB limit, ownership checked before upload, logged cleanup, looser browser file-type check.

Last full check run (2026-11-27, after merging PR #2): lint clean, typecheck clean, 89 unit tests, 44 integration tests, 19 browser tests (local Supabase), production build, responsive audit at 5 screen sizes. All passed.

## Earlier status (2026-11-14)

### Partner feed connector (2026-11-21)

- Added an opt-in, server-side JSON feed adapter for authorized rental sources (`PARTNER_FEEDS_JSON`). It validates freshness, all-in USD price lines, allowed checkout/terms/photo hosts, and normalizes offers into search results. External cards show photos, descriptions, price breakdown, checkout and cancellation details, then link to the provider's checkout.
- No named rental company is connected; the home-page source names remain planned sources. The connector requires an approved feed endpoint and credentials. External offers cannot enter Carrus checkout, because no partner booking API is configured. See `docs/PARTNER_FEEDS.md`.
- Verified with lint, typecheck, 49 unit tests, and production build. The production build required network access to fetch the existing Cardo font.
- Added a separate external **demo checkout**: offer review, test-card validation, quote freshness and price recheck, simulated confirmation, original listing link, and demo history under Trips. Its records live in `external_demo_orders` and never create native bookings or provider reservations. Migration `20261121000001` is ready but could not be applied locally because Docker Desktop was not running during this work.
- `PROVIDER_MODE=native+demo` now supplies two fictional offers with complete example prices and links to Carrus-owned fictional source pages, so the demo checkout can be exercised locally without partner credentials. No outside company data is used.

Stack: Next.js 16 + Supabase (see DECISIONS D-001). Hosted on Vercel from `main` with a hosted Supabase project; migrations deploy through the Supabase GitHub integration.

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
- Checked so far: lint, typecheck, unit tests, production build, and the migration's functions and row-level security in an in-memory Postgres. Integration tests now run on GitHub for every pull request (`.github/workflows/integration.yml`), so team members without Docker still get results. A browser pass is still to do.
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

- Milestone C: cancellation, return inspection and fee assessment (F7), disputes (F8), refunds, payout ledger, admin reports, Sanjay reservations #1004–#1011. (Pickup inspection, F6, is built above.)
- Milestone D remainder: Stripe sandbox, admin MFA, transactional email provider (the notifications outbox is ready for it). Hosting is live.
- CI runs lint, typecheck, unit tests and build (`ci.yml`) and the database integration tests (`integration.yml`) on pull requests and pushes to `main`. Browser tests still run locally only.
- Mockup alignment: the Figma mockup (see below) was received after the UI was built. Current styling is the provisional default and does **not** match it yet.

## Design reference

Figma: https://www.figma.com/design/gxRoeLKXlItVR7nLMN3eWp/Carrus-Desktop-App?node-id=10-333 (page "Carrus v2", ~60 frames, desktop 1440 wide).
Observed: serif display type, wordmark with a mountain-shaped "A", royal-blue accent, photo-led cards, nav Search / Favorites / Trips / Inbox / More, "List your car" pill, avatar menu. The file defines no Figma variables, so tokens must be read per frame.
Key frame ids: Home 37:950, Search results 37:1634, All filters 37:2086, Compare 37:2377, Trips 37:2637, Account 37:2826, Sign in 37:3058, Join the fleet 37:3089, Fleet application 37:3268, Ford Explorer details/checkout/payment/confirmation/pickup 37:7119 / 37:7308 / 37:7475 / 37:7637 / 37:7756, Host dashboard 37:7851, Add listing 37:7994, Admin verification 37:8310, Components 18:333, Assets 10:334.
The mockup conflicts with the handoff in several places; see OPEN_QUESTIONS Q-12 to Q-16 before restyling.

## Next steps (proposed order)

1. Merge PR #2 (pickup inspection, F6) and build the rest of Milestone C on it: cancellation and refunds first, then return inspection, fees, disputes, payouts.
2. Milestone D remainder: email provider for the notifications outbox, Stripe sandbox, admin MFA.
3. Answer the remaining open questions (Q-01, Q-02, Q-04, Q-06, Q-07, Q-10 to Q-12, Q-16, Q-17).

## Environment notes

- Windows 11, Node 24, Docker Desktop (installed per-user under AppData). Docker must be running before `npm run db:start`.
- `next.config.ts` turns off Cache Components (D-004). Next 16 renamed middleware to `src/proxy.ts`.
- Very long shell commands fail on Windows; write large files with an editor/tool rather than heredocs.
