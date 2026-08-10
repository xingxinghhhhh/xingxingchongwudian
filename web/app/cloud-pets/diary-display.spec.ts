import {
  isCloudPetDiaryEvent,
  resolveCloudPetDiaryDisplay
} from "./diary-display";

describe("cloud pet diary display", () => {
  it("maps structured diary types without guessing legacy records", () => {
    expect(resolveCloudPetDiaryDisplay("owner_note")).toEqual({
      label: "主人手记",
      representsCareCompletion: false
    });
    expect(resolveCloudPetDiaryDisplay("care_daily_diary")).toEqual({
      label: "照顾记录",
      representsCareCompletion: true
    });
    expect(resolveCloudPetDiaryDisplay("presence_daily_diary")).toEqual({
      label: "当日补记",
      explanation: "当天没有完成新的照顾任务，此记录仅用于补齐当天日记。",
      representsCareCompletion: false
    });
    expect(resolveCloudPetDiaryDisplay("daily_diary")).toEqual({
      label: "日常记录",
      representsCareCompletion: false
    });
    expect(resolveCloudPetDiaryDisplay("unknown_event")).toEqual({
      label: "日常记录",
      representsCareCompletion: false
    });
  });

  it("recognizes all persisted diary types", () => {
    expect(isCloudPetDiaryEvent("daily_diary")).toBe(true);
    expect(isCloudPetDiaryEvent("care_daily_diary")).toBe(true);
    expect(isCloudPetDiaryEvent("presence_daily_diary")).toBe(true);
    expect(isCloudPetDiaryEvent("growth_task")).toBe(false);
  });
});
