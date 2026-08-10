import {
  isCloudPetDiaryEventType
} from "./cloud-pet-event-types";

describe("cloud pet event types", () => {
  it("treats legacy and structured diary types as diary presence", () => {
    expect(isCloudPetDiaryEventType("daily_diary")).toBe(true);
    expect(isCloudPetDiaryEventType("care_daily_diary")).toBe(true);
    expect(isCloudPetDiaryEventType("presence_daily_diary")).toBe(true);
    expect(isCloudPetDiaryEventType("owner_note")).toBe(false);
    expect(isCloudPetDiaryEventType("unknown_event")).toBe(false);
  });
});
