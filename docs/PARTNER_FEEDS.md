# Partner listing feeds

## Test the external demo checkout locally

The app includes two **fictional** external listings so this flow can be tested without partner credentials. Start Docker Desktop, then run `npm run db:start` and `npm run db:migrate`. Ensure the existing `.env.local` has the local Supabase keys (see README); set `PROVIDER_MODE=native+demo` and restart `npm run dev`. If the local database does not have the fixture customer, run `npm run seed:demo` first. That seed resets local app data and fixture users.

Open `http://localhost:3000`, sign in as `test.customer@carrus.test` with `Test#1234`, and search San Jose, CA with future dates. The Nissan Altima and Jeep Compass cards should say **Demo rental source**. Open **Demo listing details** to see the Carrus-owned fictional source page. Return to search and choose **Try demo checkout**. Use `4242 4242 4242 4242`, any future MM/YY, any three-digit security code and five-digit ZIP. The confirmation and Trips entry must say that no provider reservation or real payment was made. Use `4000 0000 0000 0002` to test a decline.

On PowerShell systems that block `npm.ps1`, use `npm.cmd` and `npx.cmd` in these commands. Use `http://localhost:3000` for the browser, matching the app's sign-in cookies.

## Free open-data demo listings

Set `PUBLIC_DEMO_LISTINGS=true` (locally in `.env.local`, or in Vercel and then redeploy) to add about a dozen demo listings near any supported search location. They use only free, openly usable sources and need no keys:

- **Vehicles:** common rental models, each checked against the [NHTSA vPIC API](https://vpic.nhtsa.dot.gov/api/) for model year 2024. NHTSA data is U.S. government public-domain data. If NHTSA does not list a model, it is skipped; if NHTSA is unreachable, the curated list is used.
- **Photos:** the Wikimedia Commons API is searched for each model, and only images under CC0, CC BY, CC BY-SA or public-domain licenses are used. Every card, details page and checkout shows the photo title, author, license and Commons link, as those licenses require. Photos are shown unmodified and link to the Commons original.
- **Price, pickup point and availability:** generated deterministically for the demo and labeled *Demo rental source*. Demo checkout works the same way as the fictional listings above and creates no reservation or payment.

Lookups are cached for a day and each is capped at 2.5 seconds; when a lookup is slow the listing still appears with drawn artwork instead of a photo. No rental company website is scraped or contacted. Scraping sites such as Turo, Enterprise, Hertz or Kayak is against their terms and is deliberately not supported.

## Connect an authorized feed

Carrus can now include results from an authorized JSON listing feed alongside its own inventory. This connector **does not scrape websites**. The nine company names on the home page are planned sources, not active connections. Do not configure a company's site or copy its listings/photos without permission to use them.

Set `PARTNER_FEEDS_JSON` in `.env.local` to an array of feed configurations. Each has a unique `key`, public `name`, HTTPS `url`, private bearer `token`, exact `allowedHosts` for booking and terms links, and exact `imageHosts` for photos. The example in `.env.example` shows the shape. The feed must accept a GET request with `pickupAt`, `returnAt` (ISO UTC), `lat`, `lng`, and `radiusMiles` query parameters. Carrus sends `Authorization: Bearer <token>`.

Before using demo checkout on an existing local Supabase database, run `npm run db:migrate` to add `external_demo_orders`. Starting with a fresh database applies the migration automatically.

The feed response is JSON:

```json
{
  "searchedAt": "2026-11-21T20:00:00.000Z",
  "listings": [{
    "id": "supplier-offer-123",
    "make": "Toyota", "model": "Corolla", "year": 2025, "color": "Silver",
    "vehicleType": "Sedan", "seats": 5, "transmission": "Automatic",
    "description": "Supplier-provided vehicle description",
    "locationLabel": "San Jose Airport",
    "coordinates": { "lat": 37.3639, "lng": -121.9289 },
    "timeZone": "America/Los_Angeles", "exactMatch": false,
    "photoUrls": ["https://images.example.com/corolla.jpg"],
    "sourceUrl": "https://example.com/checkout/offer-123",
    "termsUrl": "https://example.com/terms/offer-123",
    "checkoutDetails": "Driver age and licence verified by Example Rentals. Pay on their checkout page.",
    "cancellationPolicy": "Supplier's stated cancellation policy",
    "price": {
      "currency": "USD", "billableDays": 3, "dailyRateCents": 5000,
      "totalCents": 18000, "dueNowCents": 18000, "depositCents": 0,
      "lines": [
        { "code": "base", "label": "Base rate", "cents": 15000 },
        { "code": "fees", "label": "Taxes and mandatory fees", "cents": 3000 }
      ]
    }
  }]
}
```

The feed must return offers available for the requested interval and a `searchedAt` timestamp no older than 15 minutes. It may return up to 100 offers per query. Carrus rejects stale, malformed, non-USD, incomplete, or inconsistent price data and marks the source unavailable. The price lines must sum to `totalCents`. URLs must use HTTPS and match configured hosts. Data is fetched for each search and not persisted.

External results expose the supplied photos, details, total, amount due, deposit, cancellation text, terms link, and provider link. A signed-in customer can run a **Carrus demo checkout** for an external offer. This stores a 15-minute quote snapshot, rechecks the feed's offer and total at submit, validates a demo card, saves a simulated confirmation, and lists it under Trips. It never reserves inventory with the provider or charges a card. The original listing link appears on the result, checkout, and confirmation pages. **A real booking and payment still require the provider website.** A Carrus-native checkout requires an actual partner booking API and agreement covering live availability, price recheck, payment, reservation creation, cancellation, and support. A public listing page cannot supply those capabilities.

The current adapter is a common feed contract, not a provider-specific integration. Each approved provider or aggregator needs its own mapper into this contract, plus confirmed permission to display photos and prices. No real company is connected until that feed and its credentials are configured.
