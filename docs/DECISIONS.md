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
| D-019 | "Demo rental sources" on the home page lists source categories rather than company names, because no company is a partner or integrated. | Proposed (Q-13) |
