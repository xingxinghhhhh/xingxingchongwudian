import {
  addUtcDays,
  canonicalizeCloudPetPrismaState
} from "./cloud-pet-prisma-smoke.helpers";

describe("cloud-pet Prisma smoke helpers", () => {
  it("canonicalizes care state and counts only automatic diaries", () => {
    expect(
      canonicalizeCloudPetPrismaState({
        growth: {
          todayCompletedTaskKeys: ["feed-care", "daily-care", "feed-care"],
          todayCompletedTaskCount: 2,
          careScore: 78,
          careState: "thriving",
          careStreakDays: 1
        },
        timeline: [
          { type: "owner_note" },
          { type: "growth_task" },
          { type: "daily_diary" },
          { type: "daily_diary" }
        ]
      })
    ).toEqual({
      completedTaskKeys: ["daily-care", "feed-care"],
      todayCompletedTaskCount: 2,
      careScore: 78,
      careState: "thriving",
      careStreakDays: 1,
      autoDiaryCount: 2
    });
  });

  it("uses UTC date arithmetic for the smoke date window", () => {
    expect(addUtcDays("2026-08-09", -1)).toBe("2026-08-08");
    expect(addUtcDays("2026-08-09", 1)).toBe("2026-08-10");
  });
});
