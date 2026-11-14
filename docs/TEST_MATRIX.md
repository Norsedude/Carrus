# Acceptance test matrix

Status reflects tests actually executed on 2026-11-14 against local Supabase (46 unit, 24 integration, 13 browser, all passing). "Not built" means the feature does not exist yet, so the case cannot run.

Levels: U = `tests/unit`, I = `tests/integration`, E = `tests/e2e` (real browser).

| ID | Expectation | Status | Where |
|---|---|---|---|
| TC-S01 | Four standard results with totals $240 / $270 / $210 / $330 | Pass | I, E |
| TC-S02 | Dec 14–17 shows only CAR-002 | Pass | I, E |
| TC-S03 | Empty location blocked | Pass | U, E |
| TC-S04 | Return before pickup blocked | Pass | U, E |
| TC-C01 | Compare two | Pass | E |
| TC-C02 | Compare three | Pass | E |
| TC-C03 | Fourth blocked | Pass | E |
| TC-C04 | Newly unavailable compared vehicle cannot book | Pass | I, E |
| TC-B01 | One successful $240 booking | Pass | I, E |
| TC-B02 | Booking retrievable after refresh | Pass | I, E |
| TC-B03 | CUSTOMER-02 overlap Dec 11–14 denied | Pass | I |
| TC-B04 | Duplicate submit yields one booking | Pass | I |
| TC-P01 | Partner listing submission goes to pending review, public after approval | Pass | I, E |
| TC-P02 | Rate edit $60 → $65 persists | Pass | I, E |
| TC-P03 | Missing daily rate rejected | Pass | I, E |
| TC-P04 | Negative daily rate rejected | Pass | I, E |
| TC-FR01 | SUV filter gives Equinox, RAV4, CR-V | Pass (logic only) | U; not run in a browser against the Sanjay seed |
| TC-FR02 | Clear gives seven | Pass (logic only) | U |
| TC-FR03 | Max $100 + seven seats gives Sienna | Pass (logic only) | U |
| TC-FR04 | Invalid seats restored with message; 15 seats + $100 gives none | Pass | U (logic), E (seats restore, on Mateo data) |
| TC-PT01 | RAV4 daily/total breakdown ($356.40) | Pass (calculation only) | U; page not checked against Sanjay seed |
| TC-PT02 | Fee policy shown | Not run | Conditional charges are displayed, no test asserts them |
| TC-PT03a | 30-day rental accepted | Pass | U |
| TC-PT03b | 31-day rental rejected | Pass | U |
| TC-PT04 | Declined payment: no booking or charge, availability released | Pass | I, E |
| TC-PC01–04 | Preparation, pickup, photo rules | Not built | Milestone C |
| TC-RA01–04 | Return assessment and fees | Not built | Milestone C |
| TC-DS01–04 | Disputes | Not built | Milestone C |
| TC-PR01 | Preconfirmation correct, no booking side effect | Pass | E |
| TC-PR02 | Stale availability blocks | Pass | I, E |
| TC-PR03 | Login retains selection | Pass | E |
| TC-CK01 | Valid simulated fields accepted | Pass | U, E |
| TC-CK02 | Declined payment handled | Pass | I, E |
| TC-CK03 | Missing required payment field blocked | Pass | U, E |
| TC-BC01 | Correct confirmation | Pass | E |
| TC-BC02 | Refresh idempotent | Pass | I, E |
| TC-BC03 | Back/resubmit idempotent | Pass | I (same key replay), E (back then revisit) |
| TC-BC04 | CUSTOMER-02 cannot read CUSTOMER-01 confirmation | Pass | I, E |

## Added coverage (not in the source test document)

Passing: sign up / sign in / wrong password / sign out / session persistence (E); password reset by emailed link (E); profile ownership (I); role-escalation attempts by a customer (I); partner cross-account access (I); unpublished listing invisible (I); unverified partner cannot list (I, E); true simultaneous holds by two customers (I); block racing a booking (I); price change and expired quote (I); payment success after hold expiry refunded (I); idempotency key reuse with different input (I); adjacent rentals allowed (I); provider partial and total failure, timeout (U); daylight-saving billable days (U); radius boundary (U).

Not covered yet: webhook replay (no webhooks exist), cancellation and refunds, saved searches, file size limits, notification retries, keyboard-only and responsive browser runs, bulk sync, wallets, deposits, moderation appeals, reports, payouts, reviews.
