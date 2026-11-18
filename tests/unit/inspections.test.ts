import { describe, expect, it } from "vitest";
import {
  MAX_PHOTO_BYTES,
  MESSAGES,
  checkConditionValues,
  checkPhoto,
  joinLabels,
  missingPhotosMessage,
  photoPath,
  quickCheckPhoto,
  sniffImageType,
} from "@/server/inspections/rules";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const PDF = new TextEncoder().encode("%PDF-1.7\n%");

describe("photo type detection (file bytes, not the file name)", () => {
  it("recognizes JPEG and PNG", () => {
    expect(sniffImageType(JPEG)).toBe("image/jpeg");
    expect(sniffImageType(PNG)).toBe("image/png");
  });
  it("refuses a PDF, an empty file and a truncated header", () => {
    expect(sniffImageType(PDF)).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
    expect(sniffImageType(PNG.slice(0, 4))).toBeNull();
  });
});

describe("checkPhoto (server side)", () => {
  it("accepts a 2 MB JPEG and a PNG at exactly 10 MB", () => {
    expect(checkPhoto({ size: 2 * 1024 * 1024, head: JPEG })).toEqual({ ok: true, contentType: "image/jpeg" });
    expect(checkPhoto({ size: MAX_PHOTO_BYTES, head: PNG })).toEqual({ ok: true, contentType: "image/png" });
  });
  it("TC-PC04: notes.pdf is refused as the wrong type", () => {
    expect(checkPhoto({ size: 1024 * 1024, head: PDF })).toEqual({ ok: false, message: "Only JPG or PNG files are allowed." });
  });
  it("TC-PC04: big.jpg (12 MB) is refused as too large, and one byte over the limit is too", () => {
    expect(checkPhoto({ size: 12 * 1024 * 1024, head: JPEG })).toEqual({ ok: false, message: "File must be 10 MB or smaller." });
    expect(checkPhoto({ size: MAX_PHOTO_BYTES + 1, head: JPEG })).toEqual({ ok: false, message: MESSAGES.tooLarge });
  });
  it("reports the wrong type first when a file is both the wrong type and too large", () => {
    expect(checkPhoto({ size: 12 * 1024 * 1024, head: PDF })).toEqual({ ok: false, message: MESSAGES.wrongType });
  });
});

describe("quickCheckPhoto (browser side, before upload)", () => {
  it("accepts .jpg, .jpeg and .png images up to 10 MB", () => {
    expect(quickCheckPhoto({ name: "front.jpg", type: "image/jpeg", size: 1_500_000 })).toBeNull();
    expect(quickCheckPhoto({ name: "FUEL.JPEG", type: "image/jpeg", size: 1_500_000 })).toBeNull();
    expect(quickCheckPhoto({ name: "interior.png", type: "image/png", size: MAX_PHOTO_BYTES })).toBeNull();
  });
  it("refuses notes.pdf, a PDF renamed to .jpg, and big.jpg", () => {
    expect(quickCheckPhoto({ name: "notes.pdf", type: "application/pdf", size: 1024 * 1024 })).toBe(MESSAGES.wrongType);
    expect(quickCheckPhoto({ name: "notes.jpg", type: "application/pdf", size: 1024 * 1024 })).toBe(MESSAGES.wrongType);
    expect(quickCheckPhoto({ name: "big.jpg", type: "image/jpeg", size: 12 * 1024 * 1024 })).toBe(MESSAGES.tooLarge);
  });
});

describe("missing photo messages", () => {
  it("TC-PC03: one missing category", () => {
    expect(missingPhotosMessage(["interior"])).toBe("Add a photo for each category: interior is missing.");
  });
  it("TC-RA04: all three missing, listed in form order", () => {
    expect(missingPhotosMessage(["interior", "exterior", "fuel_gauge"])).toBe(
      "Add a photo for each category: exterior, fuel gauge, and interior are missing.",
    );
  });
  it("two missing categories", () => {
    expect(missingPhotosMessage(["fuel_gauge", "exterior"])).toBe("Add a photo for each category: exterior and fuel gauge are missing.");
  });
  it("joins labels in plain English", () => {
    expect(joinLabels([])).toBe("");
    expect(joinLabels(["a"])).toBe("a");
  });
});

describe("condition selections", () => {
  it("accepts every option from the test data", () => {
    expect(checkConditionValues({ exteriorDamage: "Minor", fuelLevel: "1/4", cleanliness: "Light dirt" })).toEqual({});
  });
  it("requires each selection and rejects values that are not options", () => {
    expect(checkConditionValues({ exteriorDamage: "", fuelLevel: "Half", cleanliness: "dirty" })).toEqual({
      exteriorDamage: MESSAGES.selectDamage,
      fuelLevel: "Select a fuel level",
      cleanliness: MESSAGES.selectCleanliness,
    });
  });
});

describe("photo storage paths", () => {
  it("keeps each photo inside its booking's folder for that stage", () => {
    const id = "cccccccc-0000-0000-0000-000000001002";
    expect(photoPath(id, "pickup", "fuel_gauge", "image/png", "abc")).toBe(`${id}/pickup/abc-fuel_gauge.png`);
    expect(photoPath(id, "return", "interior", "image/jpeg", "xyz")).toBe(`${id}/return/xyz-interior.jpg`);
  });
});
