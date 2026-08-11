import {
  addCloudPetBusinessDays,
  getCloudPetBusinessDateKey,
  getCloudPetBusinessDayRange
} from "./cloud-pet-business-day";

describe("cloud-pet business day", () => {
  it("uses UTC midnight as the stable date boundary", () => {
    expect(getCloudPetBusinessDateKey("2026-08-11T23:59:59.999Z")).toBe(
      "2026-08-11"
    );
    expect(getCloudPetBusinessDateKey("2026-08-12T00:00:00.000Z")).toBe(
      "2026-08-12"
    );
    expect(getCloudPetBusinessDateKey("2026-08-12T08:00:00.000+08:00")).toBe(
      "2026-08-12"
    );
  });

  it("returns a half-open UTC day range", () => {
    const range = getCloudPetBusinessDayRange("2026-08-12");

    expect(range.start.toISOString()).toBe("2026-08-12T00:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-08-13T00:00:00.000Z");
  });

  it("adds whole business days without using host-local time", () => {
    expect(addCloudPetBusinessDays("2026-08-12", -1)).toBe("2026-08-11");
    expect(addCloudPetBusinessDays("2026-08-12", 2)).toBe("2026-08-14");
  });

  it("rejects malformed dates and non-integer offsets", () => {
    expect(() => getCloudPetBusinessDayRange("2026-8-12")).toThrow(
      "YYYY-MM-DD"
    );
    expect(() => getCloudPetBusinessDayRange("2026-02-31")).toThrow(
      "Invalid cloud-pet business date"
    );
    expect(() => addCloudPetBusinessDays("2026-08-12", 0.5)).toThrow(
      "integer"
    );
  });
});
