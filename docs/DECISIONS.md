# Decisions

"Approved" means Mateo decided it. "Proposed" means a default was needed to keep building; it is configurable and awaits a team decision (see OPEN_QUESTIONS).

| ID | Decision | Status |
|---|---|---|
| D-001 | Stack: one Next.js TypeScript app + Supabase (Auth, Postgres) run locally in Docker. Supersedes the README's earlier FastAPI proposal. | Approved 2026-11-14 |
| D-002 | Git: local branch `feat/milestone-a`, commit verified steps, never push; Mateo reviews and pushes. | Approved 2026-11-14 |
| D-003 | Booking happens on Carrus for Carrus inventory. External sources are adapters with capability flags; only a labeled mock exists and it is off by default. | From handoff |
| D-004 | Next.js Cache Components and partial prefetching are turned off. Almost every page reads the session or live availability, so request-time rendering is simpler and safer. | Proposed (technical) |
| D-005 | Pricing is calculated only in `src/server/pricing/pricing.ts`. Quotes and bookings are written only by server code using the secret key, after the user is authenticated; clients cannot write them. | Proposed (technical) |
| D-006 | Billable days = ceil(elapsed hours / 24), minimum 1. Maximum rental 30 billable days. | Proposed (Q-01) |
| D-007 | Two versioned pricing policies: `flat-fees@v1` (daily × days + $30 service fee + $30 taxes and surcharges; Mateo fixtures) and `protection-tax@v1` ((daily × days + $52 protection) × 1.10; Sanjay fixtures). A booking uses exactly one. New partner listings default to `flat-fees@v1`. The two $30 line names are placeholders. | Proposed (Q-02) |
| D-008 | Search radius: inclusive, straight-line miles, default 25. | Proposed |
| D-009 | Checkout hold 10 minutes; quote valid 15 minutes. | Proposed (Q-05) |
| D-010 | Visual styling was a provisional default (light surfaces, charcoal text, blue accent, illustrated vehicles). To be replaced by the Figma mockup. | Superseded pending Q-12–Q-16 |
| D-011 | Fixture identities are separate: customer, customer2, partner, partner2, admin. The source data's "test.admin as partner" mapping is corrected. Roles come only from the `user_roles` table. | From handoff |
| D-012 | Seed profiles never mix: each seed command resets first. Fixture listings are instant-book. | Proposed (Q-03) |
| D-013 | A conflicting reservation request is rejected; no waitlist or inquiry during an active hold. | Proposed (Q-06) |
| D-014 | TC-PT03 is split into 30 days accepted (TC-PT03a) and 31 days rejected (TC-PT03b). | From handoff |
| D-015 | The "$300" top of the daily-rate filter means no limit, so a vehicle above $300/day is not hidden by default. | Proposed |
| D-016 | Simulated payment accepts only three listed demo card numbers and rejects anything else, so a real card is never accepted. Card details are not stored. | Proposed |
| D-017 | A pickup in the past is rejected. For demos after the fixture dates pass, `CARRUS_FIXED_NOW` can pin the validation clock in development and test only. | Proposed |
| D-018 | New listings start as draft or pending review and become public only on admin approval. Editing the rate of an approved listing keeps it published (TC-P02). | Proposed |
| D-019 | Home page strip shows the nine company names from the team presentation (Budget, Enterprise, Hertz, Avis, Turo, Zipcar, Kayak, Expedia, Priceline) as plain text wordmarks, not official logo artwork, with a visible note that the prototype is not connected to or affiliated with them. | Approved by Mateo 2026-11-14 (names); note kept for honesty |
| D-020 | Mock listings are written by hand and use photos from the team's own Figma file. Listings and photos are not scraped from Turo, Hertz or other marketplaces: their content is copyrighted and their terms prohibit scraping. FR04 "Rental Source Scraping" stays unimplemented; real sources need authorized API access. | Proposed; needs team awareness |
| D-021 | Design: team logo PNG, Cardo everywhere, Figma colors. Exact Figma fidelity is not required for now; working features come first. | Approved by Mateo 2026-11-14 |
| D-022 | Compare limit is three, per test cases TC-C02/C03 and the design diagrams (the mockup's six is not followed). Totals shown are all-in ("taxes and fees included"), matching TC-PT01 and the mockup's detail page. | From test plan |
| D-023 | Flat-fee policy lines are named "Mandatory fees" and "Estimated taxes", per TC-B01/TC-PR01. | From test plan |
| D-024 | Home search defaults pickup to tomorrow 10:00 and return four days later, from the current date. | Approved by Mateo 2026-11-14 |
| D-029 | Request-to-book: the simulated payment is taken at checkout and refunded automatically if the partner declines or does not answer within 24 hours (Q-03 confirmed, Q-05 partner response window set to 24 h instead of the proposed 30 min, which is too short for individual hosts). | Proposed 2026-11-27 |
| D-030 | Listing photos: at most 8 per listing, JPG/PNG/WebP checked by content, 10,000,000 bytes each (Q-08), downscaled in the browser to stay under Vercel's request limit, public bucket `vehicle-photos`. | Proposed 2026-11-27 |
| D-031 | Notifications are an in-app inbox plus an outbox (`email_status`). No email provider is configured yet, so nothing is emailed besides Supabase Auth mail. | Proposed 2026-11-27 |
| D-032 | Rate limits live in Postgres (works across serverless instances) and fail open if the limiter is unavailable. Enabled in production only by default. | Proposed 2026-11-27 |
| D-033 | "Compare a pasted link" fetches one public page per user request and reads only its published metadata; it never crawls, stores the page, or works around blocks. Pasted links stay in the browser and are not sent to the full compare page. This is how the team's FR04 idea is met without scraping (see Q-18). | Approved by Mateo 2026-11-27 (feature request) |
