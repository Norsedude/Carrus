# Carrus

Latin for "cars." Carrus is a vehicle-rental locator platform that connects renters directly with rental partners based on location, budget, schedule, and vehicle fit — with transparent pricing and no hidden fees.

**Team:** Mateo Ortega, Sanjay Darshan Ramkumar, Ngoc Khanh Pham \
**Course:** CMPE 131 — Software Engineering I, Fall 2026, SJSU

## Problem

People need temporary access to vehicles when they are traveling or when their personal transportation options are unavailable. Finding the perfect rental car that fits their location, budget, schedule, and style can often feel convoluted and complicated; comparison tools like Priceline and Kayak may solve for price, but not for hidden fees, vehicle mismatch, or booking transparency

## Docs

- `docs/user-stories.md` — customer and partner user stories
- `docs/PROGRESS.md` — what is built, what is mocked, what is next (start here to resume work)
- `docs/DECISIONS.md` — decisions made and proposed defaults awaiting approval
- `docs/OPEN_QUESTIONS.md` — questions for the team
- `docs/TEST_MATRIX.md` — acceptance test IDs and their current status

## Tech stack

- Next.js 16 (App Router, React 19, TypeScript, Tailwind CSS 4)
- Supabase: Auth, Postgres with row-level security, run **locally** in Docker through the Supabase CLI
- Zod (validation), Vitest (unit and integration tests), Playwright (browser tests)

Nothing is hosted or deployed. Payments are simulated; no money moves.

## Run it locally

Prerequisites: Git, Node.js 24 (20.19+ should work), and Docker Desktop running.

```bash
npm ci
npm run db:start          # starts local Supabase in Docker; first run downloads images
cp .env.example .env.local
npx supabase status       # copy the Publishable and Secret keys into .env.local
npm run seed:demo         # six photographed demo vehicles and test accounts
npm run dev               # http://localhost:3000
```

Use `http://localhost:3000` (not `127.0.0.1`) so sign-in cookies and emailed links line up.
Never commit `.env.local`, and never overwrite an existing one without checking it first.

Local tools while Supabase is running:

- Database browser (Supabase Studio): http://127.0.0.1:54323
- Caught emails, such as password-reset links (Mailpit): http://127.0.0.1:54324

### Fixture accounts (local only)

All use the password `Test#1234`, which is public demo data from the test plan and must never be used anywhere real.

| Email | Role |
|---|---|
| `test.customer@carrus.test` | Customer (CUSTOMER-01) |
| `test.customer2@carrus.test` | Customer (CUSTOMER-02) |
| `test.partner@carrus.test` | Verified partner, owns the fixture vehicles (PARTNER-01) |
| `test.partner2@carrus.test` | Verified partner with no vehicles (PARTNER-02) |
| `test.admin@carrus.test` | Administrator |

With the demo seed, search **San Jose, CA** with the default dates. With `npm run seed:mateo` (the test-plan fixtures), search **SJC**, pickup **Dec 10 2026 10:00**, return **Dec 13 2026 10:00**.
Demo payment cards: `4242 4242 4242 4242` approves, `4000 0000 0000 0002` declines.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Develop, build, serve |
| `npm run lint` / `typecheck` | ESLint, TypeScript |
| `npm test` | Unit tests (no database needed) |
| `npm run test:integration` | Database tests against local Supabase. **Resets fixture data.** |
| `npm run test:e2e` | Browser tests (starts or reuses the dev server). **Resets fixture data.** First time: `npx playwright install chromium` |
| `npm run db:start` / `db:stop` | Start or stop local Supabase |
| `npm run db:reset` | Recreate the local database from `supabase/migrations` |
| `npm run db:migrate` | Apply new migrations to the local database |
| `npm run db:types` | Regenerate `src/lib/supabase/database.types.ts` after a schema change |
| `npm run seed:demo` | Reset, then seed six photographed showcase vehicles in San Jose, available for a year |
| `npm run seed:mateo` | Reset, then seed four SJC vehicles. Add `-- --with-reservation` for RES-TEST-001 |
| `npm run seed:sanjay` | Reset, then seed seven San Jose vehicles (January 2027 dates) |
| `npm run test:reset` | Remove all app data and fixture accounts |

Seed and reset commands refuse to run unless the Supabase host is in `TEST_DATABASE_ALLOWLIST` and `APP_ENV` is `development` or `test`.

## Project layout

- `src/app` — pages, server actions and the auth callback route
- `src/components` — shared UI
- `src/server` — pricing, search (validator, provider gateway, filters), booking and simulated payment services
- `src/lib` — environment validation, auth session helpers, Supabase clients, time and money helpers
- `supabase/migrations` — schema, row-level security and booking functions
- `scripts/seed.ts` — fixture profiles
- `tests/unit`, `tests/integration`, `tests/e2e`
