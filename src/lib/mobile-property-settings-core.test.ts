import { describe, expect, it } from "vitest";
import { validateMobilePropertySettings } from "@/lib/mobile-property-settings-core";

const valid = { minNights: "3", checkInTime: "14:00", checkOutTime: "10:00" };

describe("mobile property settings", () => {
  it("accepts the settings this apartment actually runs on", () => {
    expect(validateMobilePropertySettings(valid)).toEqual({
      ok: true,
      patch: { minNights: 3, checkInTime: "14:00", checkOutTime: "10:00" },
    });
  });

  it("refuses a minimum-nights value that is not a whole number in range", () => {
    for (const minNights of ["0", "-1", "2,5", "abc", "", "31"]) {
      expect(validateMobilePropertySettings({ ...valid, minNights }).ok, minNights).toBe(false);
    }
  });

  it("insists on a real clock time", () => {
    for (const checkInTime of ["14", "14:60", "24:00", "2pm", ""]) {
      expect(validateMobilePropertySettings({ ...valid, checkInTime }).ok, checkInTime).toBe(false);
    }
  });

  it("keeps the turnover day possible", () => {
    // Check-out at 14:00 and check-in at 10:00 would mean the next guest
    // arrives before the last one leaves.
    const result = validateMobilePropertySettings({
      minNights: "3",
      checkInTime: "10:00",
      checkOutTime: "14:00",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Wechseltag");
  });

  it("trims what a phone keyboard adds", () => {
    expect(
      validateMobilePropertySettings({ minNights: " 2 ", checkInTime: " 15:00 ", checkOutTime: " 09:30 " }),
    ).toEqual({ ok: true, patch: { minNights: 2, checkInTime: "15:00", checkOutTime: "09:30" } });
  });
});
