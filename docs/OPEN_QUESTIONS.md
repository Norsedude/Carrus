# Open questions

Each has a working default so development is not blocked. Answer when convenient; Q-12 to Q-16 block the restyle.

| ID | Question | Current default |
|---|---|---|
| Q-01 | S1 runs Jan 15 10:00 to Jan 19 18:00 but is labeled four days. Change the return to Jan 19 10:00 (keeps the four-day expected prices, recommended), or change every expected total to five days? | Ceil rule: 18:00 return bills five days. Tests use a 10:00 return. |
| Q-02 | Which pricing policy is the canonical default for new listings, and what are the two $30 lines in Mateo's $240 example actually called? | `flat-fees@v1`; lines named "Service fee" and "Taxes and surcharges". |
| Q-03 | Confirm the instant / request booking split. | Only instant is built. |
| Q-04 | Late cancellation: is the 24-hour cutoff inclusive, and what is charged after it? | Not built. |
| Q-05 | Hold durations: 10-minute checkout hold, 30-minute partner response? | 10 minutes; partner response not built. |
| Q-06 | Allow an inquiry or waitlist while another customer holds the vehicle? | No; conflicting requests are rejected. |
| Q-07 | Pickup inspection window: 15 or 20 minutes? | No window enforced yet (D-027). |
| Q-08 | Is 10 MB for photos 10,000,000 bytes? | 10 × 1024 × 1024 = 10,485,760 bytes for inspection photos. |
| Q-09 | Hosting: who creates the Supabase and Vercel projects, and when? Nothing is provisioned. | Local only. |
| Q-10 | Any real provider API access? | None; mock adapter only. |
| Q-11 | Please save `CARRUS_HANDOFF.md` into the repo (for example `docs/reference/`) so future sessions can read it, and say whether the source ZIP should be kept anywhere. | Not in the repo. |
| Q-17 | TC-P01 expects a new listing to be "published immediately; no approval step", but Admin FR03 requires admin approval before a listing reaches search. Which wins? | Admin approval required (listing is "Pending review" until approved), so TC-P01's last expectation is not met as written. |
| Q-18 | FR04 asks for scraping Enterprise, Hertz, Turo and others. That needs permission or official APIs. Does the team have any, or should sources stay mocked for the class demo? | Not implemented (D-020). |
| Q-12 | Mockup shows star ratings and trip counts ("4.8 ★ (13 trips)") and "200+ cars available". There is no review or trip-history data, and the handoff says never to fabricate reviews or counts. Omit them, or show them only when real data exists? | Omitted. |
| Q-13 | Mockup shows Budget, Enterprise, Hertz, Avis, Turo and Zipcar logos, and source filters by those names. None are partners or integrated, and using their logos implies a relationship. Keep category names, or use the names as plain text with a "not affiliated, demo" label? | Category names. |
| Q-14 | Mockup allows comparing up to 6 vehicles; test cases TC-C02/C03 say a 4th is blocked. Which is right? | 3. |
| Q-15 | Mockup shows "$184 total · 4 days, before taxes". Carrus's stated promise is the full total including fees. Show the all-in total (current), or the mockup's before-tax total? | All-in total. |
| Q-16 | Mockup adds Favorites, Inbox, Help and support, and vehicles such as Mustang / M2 / 720S with photographs. Are Favorites and Inbox in scope for the class demo, and where do the vehicle photos come from (the Figma file's images, or will the team supply licensed photos)? | Not built; illustrated vehicles. |
