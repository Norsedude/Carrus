import { expect, test, type Page } from "@playwright/test";
import { createQuote, submitCheckout } from "../../src/server/booking/service";
import { seedMateo } from "../../scripts/seed";
import { admin } from "../integration/helpers";

// Milestone B end to end (Mateo fixture profile, local Supabase).
const SEARCH = "/search?location=SJC&pickup=2026-12-10T10:00&return=2026-12-13T10:00";
let fx: Awaited<ReturnType<typeof seedMateo>>;

test.beforeEach(async ({ page }) => {
  fx = await seedMateo(false);
  await page.addInitScript(() => window.localStorage.clear());
});

async function login(page: Page, name: string, next = "/") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
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

test("request to book: customer requests, partner approves, both get inbox updates", async ({ page }) => {
  await admin.from("vehicles").update({ booking_mode: "request" }).eq("id", fx.vehicles["CAR-002"]);
  await login(page, "test.customer");
  await page.goto(SEARCH);
  await expect(card(page, "CAR-002").getByText("Host approval")).toBeVisible();
  await card(page, "CAR-002").getByRole("link", { name: /View deal/ }).click();
  await expect(page.getByRole("heading", { name: "Availability" })).toBeVisible();
  await expect(page.locator('[data-status="available"]').first()).toBeVisible();
  await page.getByRole("button", { name: "Request to book" }).click();
  await expect(page.getByText("Host approval required").first()).toBeVisible();
  await page.getByRole("link", { name: "Continue to checkout" }).click();
  await page.getByLabel("Full name").fill("Casey Customer");
  await page.getByLabel("Mobile phone").fill("408-555-0101");
  await page.getByLabel("Card number").fill("4242 4242 4242 4242");
  await page.getByLabel("Expiry (MM/YY)").fill("12/30");
  await page.getByLabel("Security code").fill("123");
  await page.getByLabel("Billing ZIP").fill("95123");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Pay \$270\.00 and request/ }).click();
  await expect(page.getByRole("heading", { name: "Request sent to the host" })).toBeVisible();
  const reference = await page.getByTestId("booking-reference").textContent();

  await page.goto("/inbox");
  await expect(page.locator('[data-testid="notification"][data-kind="booking.requested"]')).toBeVisible();

  await signOut(page);
  await login(page, "test.partner", "/partner");
  await expect(page.getByTestId("pending-requests")).toContainText(reference!);
  await page.getByTestId("pending-requests").getByRole("link", { name: reference! }).click();
  await page.getByRole("button", { name: "Approve request" }).click();
  await expect(page.getByTestId("respond-result")).toContainText("Request approved");

  await signOut(page);
  await login(page, "test.customer", "/inbox");
  await expect(page.locator('[data-testid="notification"][data-kind="booking.approved"]')).toBeVisible();
  await expect(page.getByRole("link", { name: /Inbox, \d+ unread/ })).toBeVisible();
  await page.getByRole("button", { name: "Mark all as read" }).click();
  await expect(page.getByRole("link", { name: "Inbox", exact: true })).toBeVisible();
});

test("saved searches: save from results, reopen and delete from the account page", async ({ page }) => {
  await login(page, "test.customer");
  await page.goto(`${SEARCH}&type=SUV`);
  await page.getByRole("button", { name: "Save search" }).click();
  await expect(page.getByText("Search saved.")).toBeVisible();
  await page.goto("/account");
  const saved = page.getByTestId("saved-searches");
  await expect(saved).toContainText("SUV");
  await saved.getByRole("link").first().click();
  await expect(page.getByTestId("result-count")).toHaveText("2 vehicles found");
  await page.goto("/account");
  await page.getByRole("button", { name: /Delete saved search/ }).click();
  await expect(page.getByText("Run a search and choose")).toBeVisible();
});

test("partner adds a second availability window, request mode and a photo", async ({ page }) => {
  await login(page, "test.partner", `/partner/vehicles/${fx.vehicles["CAR-003"]}/edit`);
  await page.getByLabel("Booking mode").selectOption("request");
  await page.getByRole("button", { name: "Add another window" }).click();
  await page.getByLabel("Window 2 from").fill("2027-01-05T10:00");
  await page.getByLabel("Window 2 until").fill("2027-01-20T10:00");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByTestId("partner-notice")).toContainText("Changes saved");
  const windows = await admin.from("availability_windows").select("start_at").eq("vehicle_id", fx.vehicles["CAR-003"]);
  expect(windows.data).toHaveLength(2);
  expect((await admin.from("vehicles").select("booking_mode").eq("id", fx.vehicles["CAR-003"]).single()).data?.booking_mode).toBe("request");

  await page.goto(`/partner/vehicles/${fx.vehicles["CAR-003"]}/edit#photos`);
  const png = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4b20000000049454e44ae426082", "hex");
  await page.getByLabel("Add photos").setInputFiles({ name: "corolla.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByText("1 photo added.")).toBeVisible();
  await expect(page.getByTestId("photo-list").locator("img")).toHaveCount(1);
  await expect(page.getByText("Cover photo")).toBeVisible();
  // A non-image is refused without storing anything.
  await page.getByLabel("Add photos").setInputFiles({ name: "notes.png", mimeType: "image/png", buffer: Buffer.from("not really an image") });
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByText(/not a JPG, PNG or WebP image/)).toBeVisible();
  await expect(page.getByTestId("photo-list").locator("img")).toHaveCount(1);
});

test("compare: add a listing from a pasted link next to search results", async ({ page }) => {
  await page.goto(SEARCH);
  await card(page, "CAR-001").getByRole("checkbox", { name: /Compare/ }).click();
  await page.getByTestId("compare-tray").getByRole("button", { name: "Add a link" }).click();
  const dialog = page.getByTestId("add-link-dialog");
  // A private address is refused; the user can still type details by hand.
  await dialog.getByLabel("Listing link").fill("http://127.0.0.1/admin");
  await dialog.getByRole("button", { name: "Look up" }).click();
  await expect(dialog.getByText("not a public website")).toBeVisible();
  await dialog.getByLabel("Car name").fill("Neighbor's Mazda CX-5");
  await dialog.getByLabel("Daily rate ($)").fill("65");
  await dialog.getByRole("button", { name: "Add to comparison" }).click();
  await expect(page.getByTestId("compare-tray")).toContainText("Neighbor's Mazda CX-5");
  await page.getByRole("button", { name: /Compare here/ }).click();
  const sheet = page.getByTestId("compare-sheet");
  await expect(sheet.getByTestId("sheet-column")).toHaveCount(2);
  await expect(sheet).toContainText("Your link");
  await expect(sheet).toContainText("$195.00"); // $65 x 3 days
  await expect(sheet).toContainText("$240.00");
});

test("pickup check (F6): partner marks ready; a server error keeps the customer's choices and photos; then it saves", async ({ page }) => {
  const q = await createQuote(admin, { vehicleId: fx.vehicles["CAR-001"], pickupAt: new Date("2026-12-10T18:00:00Z"), returnAt: new Date("2026-12-13T18:00:00Z"), userId: fx.ids.customer1 });
  if (!q.ok) throw new Error(q.code);
  const out = await submitCheckout(admin, { userId: fx.ids.customer1, quoteId: q.quoteId, idempotencyKey: crypto.randomUUID(), cardNumber: "4242424242424242", contactName: "Casey Customer", contactPhone: "408-555-0101" });
  if (out.status !== "confirmed") throw new Error(out.status);

  await login(page, "test.partner", `/partner/reservations/${out.bookingId}`);
  await page.getByText("Prepare vehicle").click();
  await page.getByLabel("Vehicle is clean").check();
  await page.getByLabel("Fuel level is Full").check();
  await page.getByRole("button", { name: "Confirm ready" }).click();
  await expect(page.getByText(/Marked ready on/)).toBeVisible();
  await signOut(page);

  await login(page, "test.customer", `/trips/${out.bookingId}/pickup-check`);
  const jpeg = Buffer.from("ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffc0000b080001000101011100ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc400b5100002010303020403050504040000017d01020300041105122131410613516107227114328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffda0008010100003f00fbd3ffd9", "hex");
  await page.getByLabel("Exterior damage").selectOption("None");
  await page.getByLabel("Fuel level").selectOption("Full");
  await page.getByLabel("Cleanliness").selectOption("Clean");
  await page.getByLabel("Exterior photo").setInputFiles({ name: "front.jpg", mimeType: "image/jpeg", buffer: jpeg });
  await page.getByLabel("Fuel gauge photo").setInputFiles({ name: "fuel.jpg", mimeType: "image/jpeg", buffer: jpeg });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Submit" }).click();
  // TC-PC03: interior missing. Everything already entered stays in place.
  await expect(page.getByText("Add a photo for each category: interior is missing.")).toBeVisible();
  await expect(page.getByLabel("Exterior damage")).toHaveValue("None");
  await expect(page.getByLabel("Cleanliness")).toHaveValue("Clean");
  await expect(page.getByRole("checkbox")).toBeChecked();
  expect(await page.getByLabel("Exterior photo").evaluate((el: HTMLInputElement) => el.files?.length)).toBe(1);

  await page.getByLabel("Interior photo").setInputFiles({ name: "inside.jpg", mimeType: "image/jpeg", buffer: jpeg });
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("Condition check saved.")).toBeVisible();
  expect((await admin.from("bookings").select("state").eq("id", out.bookingId).single()).data?.state).toBe("active");
  expect((await admin.from("inspection_photos").select("id")).data).toHaveLength(3);
});
