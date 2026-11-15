import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createQuote, submitCheckout } from "../../src/server/booking/service";
import { seedMateo } from "../../scripts/seed";
import { MATEO, admin } from "../integration/helpers";

// End-to-end acceptance tests through the real pages (Mateo fixture profile).
const SEARCH = "/search?location=SJC&pickup=2026-12-10T10:00&return=2026-12-13T10:00";
let fx: Awaited<ReturnType<typeof seedMateo>>;

test.beforeEach(async () => {
  fx = await seedMateo(false);
});

async function login(page: Page, name: string) {
  await page.getByLabel("Email").fill(`${name}@carrus.test`);
  await page.getByLabel("Password").fill("Test#1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("link", { name: "Account", exact: true })).toBeVisible();
}
async function signOut(page: Page) {
  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
}
const card = (page: Page, code: string) => page.locator(`[data-testid="vehicle-card"][data-code="${code}"]`);
const bookingCount = async () => (await admin.from("bookings").select("id")).data?.length ?? -1;

async function fillCheckout(page: Page, number: string) {
  await page.getByLabel("Full name").fill("Casey Customer");
  await page.getByLabel("Mobile phone").fill("408-555-0101");
  await page.getByLabel("Card number").fill(number);
  await page.getByLabel("Expiry (MM/YY)").fill("12/30");
  await page.getByLabel("Security code").fill("123");
  await page.getByLabel("Billing ZIP").fill("95123");
  await page.getByRole("checkbox").check();
}

test.describe("search", () => {
  test("TC-S01: home search returns the four vehicles with full totals", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Where").fill("SJC");
    await page.getByLabel("Pickup", { exact: true }).fill("2026-12-10T10:00");
    await page.getByLabel("Return", { exact: true }).fill("2026-12-13T10:00");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByTestId("result-count")).toHaveText("4 vehicles found");
    const totals = { "CAR-001": "$240.00", "CAR-002": "$270.00", "CAR-003": "$210.00", "CAR-004": "$330.00" };
    for (const [code, total] of Object.entries(totals)) {
      await expect(card(page, code).getByTestId("card-total")).toHaveText(total);
    }
  });

  test("TC-S02: revised dates show only CAR-002", async ({ page }) => {
    await page.goto("/search?location=SJC&pickup=2026-12-14T10:00&return=2026-12-17T10:00");
    await expect(page.getByTestId("result-count")).toHaveText("1 vehicle found");
    await expect(card(page, "CAR-002")).toBeVisible();
  });

  test("TC-S03 / TC-S04: empty location and return-before-pickup are blocked with messages", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Where").fill("");
    await page.getByLabel("Pickup", { exact: true }).fill("2026-12-13T10:00");
    await page.getByLabel("Return", { exact: true }).fill("2026-12-10T10:00");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByText("Enter a pickup location")).toBeVisible();
    await expect(page.getByText("Return must be after pickup")).toBeVisible();
    await expect(page.getByTestId("vehicle-card")).toHaveCount(0);
  });

  test("filters: seven-seat filter keeps the Explorer; invalid seats restores the last valid value", async ({ page }) => {
    await page.goto(SEARCH);
    const seats = page.getByLabel("Minimum seats");
    await seats.fill("16");
    await seats.blur();
    await expect(page.getByText("Enter a whole number from 1 to 15")).toBeVisible();
    await expect(seats).toHaveValue("1");
    // TC-FR03: an invalid value followed by Apply keeps the results and shows the message.
    await seats.fill("2.5");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("Enter a whole number from 1 to 15")).toBeVisible();
    await expect(seats).toHaveValue("1");
    await expect(page.getByTestId("result-count")).toHaveText("4 vehicles found");
    await seats.fill("7");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByTestId("result-count")).toHaveText("1 vehicle found");
    await expect(card(page, "CAR-004")).toBeVisible();
    await page.getByRole("link", { name: "Clear all" }).click();
    await expect(page.getByTestId("result-count")).toHaveText("4 vehicles found");
  });
});

test.describe("compare", () => {
  test("TC-C01 / TC-C02 / TC-C03: compare two, then three; a fourth is blocked", async ({ page }) => {
    await page.goto(SEARCH);
    await card(page, "CAR-001").getByRole("checkbox", { name: /Compare/ }).click();
    await card(page, "CAR-002").getByRole("checkbox", { name: /Compare/ }).click();
    await page.getByRole("link", { name: /^Compare/ }).first().click();
    await expect(page.getByTestId("compare-column")).toHaveCount(2);
    await expect(page.getByTestId("compare-total")).toHaveText(["$240.00", "$270.00"]);

    await page.goto(SEARCH);
    await card(page, "CAR-003").getByRole("checkbox", { name: /Compare/ }).click();
    await card(page, "CAR-004").getByRole("checkbox", { name: /Compare/ }).click();
    await expect(card(page, "CAR-004").getByText("You can compare up to 3 vehicles")).toBeVisible();
    await page.getByRole("link", { name: /^Compare/ }).first().click();
    await expect(page.getByTestId("compare-column")).toHaveCount(3);
  });

  test("TC-C04: a compared vehicle that became unavailable cannot be booked", async ({ page }) => {
    const ids = `${fx.vehicles["CAR-001"]},${fx.vehicles["CAR-002"]}`;
    const url = `/compare?ids=${ids}&pickup=2026-12-10T10:00&return=2026-12-13T10:00&location=SJC`;
    await page.goto(url);
    await expect(page.getByRole("button", { name: /Continue/ })).toHaveCount(2);
    // Another customer books CAR-001 while this page is open.
    const q = await createQuote(admin, { vehicleId: fx.vehicles["CAR-001"], pickupAt: MATEO.pickup, returnAt: MATEO.ret, userId: fx.ids.customer2 });
    if (!q.ok) throw new Error("quote");
    await submitCheckout(admin, { userId: fx.ids.customer2, quoteId: q.quoteId, idempotencyKey: randomUUID(), contactName: "Cam", contactPhone: "408-555-0102", cardNumber: "4242424242424242" });
    // Continuing with the stale column is refused and explained.
    await page.getByRole("button", { name: /Continue with 2024 Toyota Camry/ }).click();
    await expect(page.getByText("That vehicle is no longer available for these dates")).toBeVisible();
    await expect(page.getByText("No longer available for these dates", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Continue/ })).toHaveCount(1);
    expect(await bookingCount()).toBe(1);
  });
});

test.describe("booking", () => {
  test("TC-PR01 / TC-PR03 / TC-CK01 / TC-B01 / TC-B02 / TC-BC01-03: reserve CAR-001 for $240 end to end", async ({ page }) => {
    await page.goto(SEARCH);
    await card(page, "CAR-001").getByRole("link", { name: /View deal/ }).click();
    await expect(page.getByTestId("price-total")).toHaveText("$240.00");
    await page.getByRole("button", { name: "Reserve this vehicle" }).click();

    // Preconfirmation: correct details, and no booking side effect.
    await expect(page.getByRole("heading", { name: "Review your reservation" })).toBeVisible();
    await expect(page.getByTestId("trip-vehicle")).toHaveText("2024 Toyota Camry");
    await expect(page.getByTestId("price-total")).toHaveText("$240.00");
    await expect(page.getByText("Free cancellation up to 24 hours before pickup.")).toBeVisible();
    await page.reload();
    expect(await bookingCount()).toBe(0);
    expect((await admin.from("occupancy").select("id")).data).toHaveLength(0);

    // Sign-in is required at checkout and the selection is retained.
    await page.getByRole("link", { name: "Continue to checkout" }).click();
    await expect(page).toHaveURL(/\/login\?next=/);
    await login(page, "test.customer");
    await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
    await expect(page.getByTestId("trip-vehicle")).toHaveText("2024 Toyota Camry");

    await fillCheckout(page, "4242 4242 4242 4242");
    await page.getByRole("button", { name: /Pay \$240\.00 and reserve/ }).click();
    await expect(page.getByRole("heading", { name: "Your reservation is confirmed" })).toBeVisible();
    const reference = await page.getByTestId("booking-reference").textContent();
    expect(reference).toMatch(/^CR-\d+$/);
    await expect(page.getByTestId("price-total")).toHaveText("$240.00");
    await expect(page.getByTestId("payment-line")).toContainText("Simulated payment of $240.00");
    const confirmationUrl = page.url();

    // Refresh and back/resubmit never create a second booking.
    await page.reload();
    await expect(page.getByTestId("booking-reference")).toHaveText(reference!);
    await page.goBack();
    await page.goto(confirmationUrl.replace(/\/bookings\/.*/, "") + "/trips");
    await expect(page.locator(`[data-testid="trip-row"][data-reference="${reference}"]`)).toBeVisible();
    expect(await bookingCount()).toBe(1);

    // The vehicle is gone from search for those dates.
    await page.goto(SEARCH);
    await expect(page.getByTestId("result-count")).toHaveText("3 vehicles found");
    await expect(card(page, "CAR-001")).toHaveCount(0);

    // The partner dashboard shows the same reservation.
    await signOut(page);
    await page.goto("/login?next=/partner");
    await login(page, "test.partner");
    await expect(page.locator(`[data-testid="reservation-row"][data-reference="${reference}"]`)).toContainText("$240.00");

    // TC-BC04: a different customer cannot open the confirmation.
    await signOut(page);
    await page.goto(`/login?next=${encodeURIComponent(new URL(confirmationUrl).pathname)}`);
    await login(page, "test.customer2");
    await expect(page.getByText(/could not be found|404/i).first()).toBeVisible();
    await expect(page.getByText(reference!)).toHaveCount(0);
  });

  test("TC-CK02 / TC-CK03 / TC-PT04: missing field is blocked; declined payment makes no booking and frees the car", async ({ page }) => {
    await page.goto("/login?next=/");
    await login(page, "test.customer");
    await page.goto(`/vehicles/${fx.vehicles["CAR-002"]}?pickup=2026-12-10T10:00&return=2026-12-13T10:00&location=SJC`);
    await page.getByRole("button", { name: "Reserve this vehicle" }).click();
    await page.getByRole("link", { name: "Continue to checkout" }).click();

    await fillCheckout(page, "4242 4242 4242 4242");
    await page.getByLabel("Security code").fill("");
    await page.getByRole("button", { name: /Pay \$270\.00/ }).click();
    await expect(page.getByText("Enter the security code")).toBeVisible();
    expect(await bookingCount()).toBe(0);

    await fillCheckout(page, "4000 0000 0000 0002");
    await page.getByRole("button", { name: /Pay \$270\.00/ }).click();
    await expect(page.getByTestId("checkout-message")).toContainText("Your card was declined.");
    expect(await bookingCount()).toBe(0);
    expect((await admin.from("payments").select("state")).data).toEqual([{ state: "failed" }]);

    // Retry with the approving card succeeds: availability was released.
    await fillCheckout(page, "4242 4242 4242 4242");
    await page.getByRole("button", { name: /Pay \$270\.00/ }).click();
    await expect(page.getByRole("heading", { name: "Your reservation is confirmed" })).toBeVisible();
    expect(await bookingCount()).toBe(1);
  });

  test("TC-PR02: stale availability blocks at preconfirmation", async ({ page }) => {
    await page.goto(`/vehicles/${fx.vehicles["CAR-003"]}?pickup=2026-12-10T10:00&return=2026-12-13T10:00&location=SJC`);
    await page.getByRole("button", { name: "Reserve this vehicle" }).click();
    await expect(page.getByRole("link", { name: "Continue to checkout" })).toBeVisible();
    const q = await createQuote(admin, { vehicleId: fx.vehicles["CAR-003"], pickupAt: MATEO.pickup, returnAt: MATEO.ret, userId: fx.ids.customer2 });
    if (!q.ok) throw new Error("quote");
    await submitCheckout(admin, { userId: fx.ids.customer2, quoteId: q.quoteId, idempotencyKey: randomUUID(), contactName: "Cam", contactPhone: "408-555-0102", cardNumber: "4242424242424242" });
    await page.reload();
    await expect(page.getByTestId("quote-blocked")).toContainText("no longer available");
    await expect(page.getByRole("link", { name: "Continue to checkout" })).toHaveCount(0);
  });
});

test.describe("accounts, partners and admin", () => {
  test("register, stay signed in across reloads, sign out, sign back in", async ({ page }) => {
    const email = `e2e.${Date.now()}@carrus.test`;
    await page.goto("/signup");
    await page.getByLabel("Your name").fill("Riley Renter");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("Sup3r#Secret");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByTestId("account-email")).toHaveText(email);
    await page.reload();
    await expect(page.getByTestId("account-email")).toHaveText(email);
    await signOut(page);
    await page.goto("/trips");
    await expect(page).toHaveURL(/\/login/);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByTestId("form-message")).toContainText("do not match");
    await page.getByLabel("Password").fill("Sup3r#Secret");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "My trips" })).toBeVisible();
    // A customer cannot open partner or admin pages.
    await page.goto("/admin");
    await expect(page.getByText("does not have access")).toBeVisible();
    await page.goto("/partner");
    await expect(page).toHaveURL(/join-the-fleet/);
  });

  test("password reset: emailed link lets the user choose a new password", async ({ page }) => {
    const email = "test.customer2@carrus.test";
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByTestId("form-message")).toContainText("reset link is on its way");
    // Local Supabase delivers mail to Mailpit; read the newest message for this address.
    let link = "";
    await expect(async () => {
      const list = await (await fetch(`http://127.0.0.1:54324/api/v1/search?query=${encodeURIComponent(`to:${email}`)}&limit=1`)).json();
      const id = list.messages[0].ID;
      const message = await (await fetch(`http://127.0.0.1:54324/api/v1/message/${id}`)).json();
      link = /https?:\/\/[^\s"<>)]+\/auth\/v1\/verify[^\s"<>)]+/.exec(message.Text ?? message.HTML)![0].replace(/&amp;/g, "&");
      expect(new Date(message.Date).getTime()).toBeGreaterThan(Date.now() - 30_000);
    }).toPass({ timeout: 15_000 });
    await page.goto(link);
    await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
    await page.getByLabel("New password", { exact: true }).fill("short");
    await page.getByLabel("Repeat new password").fill("short");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Use at least 8 characters")).toBeVisible();
    await page.getByLabel("New password", { exact: true }).fill("N3w#Password");
    await page.getByLabel("Repeat new password").fill("N3w#Password");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Your password was changed.")).toBeVisible();
    await signOut(page);
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("N3w#Password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByTestId("account-email")).toHaveText(email);
  });

  test("TC-P02 / TC-P03 / TC-P04: partner rate edit persists; missing and negative rates are rejected", async ({ page }) => {
    await page.goto("/login?next=/partner");
    await login(page, "test.partner");
    const row = page.locator('[data-testid="fleet-row"][data-code="CAR-001"]');
    await expect(row.getByTestId("fleet-rate")).toHaveText("$60.00");
    await row.getByRole("link", { name: /Edit/ }).click();
    const rate = page.getByLabel("Daily rate ($)");
    await rate.fill("");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Enter a daily rate")).toBeVisible();
    await rate.fill("-5");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Daily rate must be a positive dollar amount")).toBeVisible();
    await rate.fill("65");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByTestId("partner-notice")).toHaveText("Changes saved.");
    await page.reload();
    await expect(row.getByTestId("fleet-rate")).toHaveText("$65.00");
    // Three days at $65 plus $60 of fees.
    await page.goto(SEARCH);
    await expect(card(page, "CAR-001").getByTestId("card-total")).toHaveText("$255.00");
  });

  test("TC-P01: apply to the fleet, admin verifies, listing is reviewed, then appears in search", async ({ page }) => {
    const email = `host.${Date.now()}@carrus.test`;
    await page.goto("/signup?next=/join-the-fleet");
    await page.getByLabel("Your name").fill("Harper Host");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("Sup3r#Secret");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.getByLabel("I am applying as").selectOption("individual");
    await page.getByLabel("Name customers will see").fill("Harper's Hatchbacks");
    await page.getByRole("button", { name: "Submit application" }).click();
    await expect(page.getByTestId("application-status")).toContainText("waiting for an administrator");
    await page.goto("/partner/vehicles/new");
    await expect(page).toHaveURL(/join-the-fleet/); // pending partners cannot list

    await signOut(page);
    await page.goto("/login?next=/admin");
    await login(page, "test.admin");
    await page.locator('[data-testid="pending-partner"]', { hasText: "Harper's Hatchbacks" }).getByRole("button", { name: /Approve/ }).click();
    await expect(page.getByText("Partner application updated.")).toBeVisible();

    await signOut(page);
    await page.goto("/login?next=/partner/vehicles/new");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("Sup3r#Secret");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByLabel("Make").fill("Mazda");
    await page.getByLabel("Model").fill("3");
    await page.getByLabel("Year").fill("2023");
    await page.getByLabel("Color").fill("Red");
    await page.getByLabel("Vehicle type").selectOption("Sedan");
    await page.getByLabel("Seats").fill("5");
    await page.getByLabel("Pickup location").selectOption("sjc");
    await page.getByLabel("Daily rate ($)").fill("55");
    await page.getByLabel("Available from").fill("2026-12-01T00:00");
    await page.getByLabel("Available until").fill("2026-12-31T00:00");
    await page.getByRole("button", { name: "Submit for review" }).click();
    await expect(page.getByTestId("partner-notice")).toContainText("submitted for administrator review");
    await expect(page.locator('[data-testid="fleet-row"]')).toContainText("Pending review");

    // Not public before approval.
    await page.goto(SEARCH);
    await expect(page.getByTestId("result-count")).toHaveText("4 vehicles found");

    await signOut(page);
    await page.goto("/login?next=/admin");
    await login(page, "test.admin");
    await page.locator('[data-testid="pending-listing"]', { hasText: "Mazda" }).getByRole("button", { name: /Approve/ }).click();
    await expect(page.getByText("Listing review recorded.")).toBeVisible();
    await page.goto(SEARCH);
    await expect(page.getByTestId("result-count")).toHaveText("5 vehicles found");
    await expect(page.getByRole("heading", { name: "Mazda 3" })).toBeVisible();
    await expect(page.getByText("Harper's Hatchbacks · Verified partner")).toBeVisible();
  });
});
