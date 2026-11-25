# Private Carrus deployment

This is the setup for an always-available Carrus preview that deploys after a push to `main`. Vercel runs the Next.js app; a hosted Supabase project runs Auth and Postgres. The app's own password gate protects web pages before the normal Carrus account sign-in. Payments and external checkout remain simulations.

## Accounts and initial setup

1. Create Vercel and Supabase accounts. Import the mirrored GitHub repository `Norsedude/Carrus`; the account used for each integration needs access to it. Keep the production Supabase project separate from the local Docker database.
2. Choose a Supabase plan. The Free plan can pause after low activity; choose a paid plan if the database must stay available 24/7. [Supabase pausing policy](https://supabase.com/docs/guides/platform/free-project-pausing).
3. Create a hosted Supabase project. Connect its GitHub integration to this repository, working directory `.`, production branch `main`, and enable **Deploy to production**. Apply the migrations in `supabase/migrations` before testing the site. [Supabase GitHub integration](https://supabase.com/docs/guides/deployment/branching/github-integration). Do not run `seed:demo` against production: seed scripts are intentionally local-only and reset data.
4. In the Supabase dashboard, note the **Project URL**, **publishable key**, and **secret key**. Keep the secret key private. Set the Auth Site URL to the final HTTPS site URL and allow `https://YOUR-SITE/auth/callback` as a redirect URL. Email confirmation and password reset require deliverable email; configure custom SMTP if users beyond pre-authorized team addresses need Auth emails. [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
5. Run `node scripts/generate-site-access.mjs` locally. Save the printed site password in a password manager and share it only with intended viewers. The printed hash and session secret are server-side environment variables. Do not paste them into Git or commit `.env.local`. Generating a new session secret signs out everyone from the site gate.
6. Import the GitHub repository into Vercel as a Next.js project. Set `main` as its Production Branch. Vercel deploys new commits to that branch automatically. [Vercel Git deployments](https://vercel.com/docs/git).

## Vercel environment variables

Set these for **Production** in Vercel project settings before the first deployment:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Hosted Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Hosted publishable key |
| `SUPABASE_SECRET_KEY` | Hosted secret key, server-side only |
| `APP_BASE_URL` | Final Vercel or custom HTTPS origin, without trailing slash |
| `APP_ENV` | `production` |
| `PAYMENT_MODE` | `simulated` |
| `PROVIDER_MODE` | `native+demo` for fictional external checkout examples, or `native` |
| `PUBLIC_DEMO_LISTINGS` | `true` to show free open-data demo listings (NHTSA models, Wikimedia Commons photos, demo prices) near every search; omit or `false` to hide them |
| `SITE_ACCESS_PASSWORD_HASH` | Hash generated in step 5 |
| `SITE_ACCESS_SESSION_SECRET` | Session secret generated in step 5 |

Leave `CARRUS_FIXED_NOW` and `TEST_DATABASE_ALLOWLIST` unset in production. Add `PARTNER_FEEDS_JSON` only when an authorized feed is available. Vercel may assign a URL at project creation; once it is known, set `APP_BASE_URL` to that exact origin, update Supabase Auth URLs, and redeploy. Changing Vercel environment variables requires a redeploy. Never expose the secret key through a `NEXT_PUBLIC_` variable.

## First use and ongoing updates

The hosted database starts empty. Create or invite the first Carrus account through Supabase Auth. The user trigger creates a customer role. To make one trusted account an administrator, insert an `admin` row for its user ID in `public.user_roles` using the Supabase SQL editor. Grant this only to the intended owner. That admin can then review partner applications and listings through Carrus. Do not use public fixture passwords on a hosted project.

Develop locally on a branch, run lint/tests/build, then merge or push the finished commit to `main`. A push triggers a new Vercel production deployment. The Supabase GitHub integration applies new migration files from the same branch. Verify both deployment statuses before using a schema-dependent feature; the two services deploy independently and can finish in either order. Local saves alone do not update the hosted site. [Vercel Git deployments](https://vercel.com/docs/git), [Supabase migration deployment](https://supabase.com/docs/guides/deployment/database-migrations).

The password gate is enforced by Carrus for its pages and image routes, with a seven-day signed browser cookie. Visitors then use individual Carrus accounts for customer, partner, or admin actions. The logo, favicon, and framework static files remain directly available. The hosted Supabase API is a separate service governed by its row-level security policies; the site password does not replace those policies. For strict host-level protection of every deployment request, Vercel's built-in production password feature is available on qualifying paid plans. [Vercel deployment protection](https://vercel.com/docs/deployment-protection).

## Verify before sharing

1. Open the production URL in a private browser window. It should show the site-password page before any Carrus content.
2. Try a wrong password, then the saved password. Confirm the site opens, and refresh it.
3. Sign in to a Carrus account. Search, open a vehicle, and check that the database returns results after listings have been added and approved.
4. Open a second private window to confirm it still asks for the site password. Check the Vercel and Supabase deployment logs after each push to `main`.
