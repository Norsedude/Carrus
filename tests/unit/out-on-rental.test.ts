import { describe, expect, it } from "vitest";
import { isOutOnRental } from "@/server/booking/out-on-rental";

const now = new Date("2026-12-11T12:00:00Z").getTime();
const trip = { pickup_at: "2026-12-10T18:00:00Z", return_at: "2026-12-13T18:00:00Z" };
const past = { pickup_at: "2026-12-01T18:00:00Z", return_at: "2026-12-04T18:00:00Z" };
const future = { pickup_at: "2026-12-20T18:00:00Z", return_at: "2026-12-23T18:00:00Z" };

describe("partner dashboard: out on rental now", () => {
  it("counts confirmed and ready-for-pickup reservations inside their window", () => {
    expect(isOutOnRental({ state: "confirmed", ...trip }, now)).toBe(true);
    expect(isOutOnRental({ state: "ready_for_pickup", ...trip }, now)).toBe(true);
    expect(isOutOnRental({ state: "ready_for_pickup", ...future }, now)).toBe(false);
  });
  it("counts picked-up (active) cars until their return time, not forever", () => {
    expect(isOutOnRental({ state: "active", ...trip }, now)).toBe(true);
    expect(isOutOnRental({ state: "active", ...future }, now)).toBe(true); // picked up early
    expect(isOutOnRental({ state: "active", ...past }, now)).toBe(false);
  });
  it("ignores requests, cancellations and completed trips", () => {
    for (const state of ["pending_partner", "declined", "expired", "cancelled", "completed"]) {
      expect(isOutOnRental({ state, ...trip }, now)).toBe(false);
    }
  });
});
