import {
  careScoreBaseFromStats,
  careScoreBonusFromProfile,
  canonicalizeCloudPetOpsConfig
} from "./cloud-pet-ops-config-prisma-smoke.helpers";

describe("cloud-pet operations config Prisma smoke helpers", () => {
  it("canonicalizes configuration snapshots without depending on response field order", () => {
    expect(
      canonicalizeCloudPetOpsConfig(
        {
          key: "daily-care",
          points: "27",
          rewards: { intimacy: "15", mood: 8, energy: 4 }
        },
        {
          dailyTaskBonus: "19",
          steadyMinScore: 60,
          thrivingMinScore: 70,
          thrivingRequiresCareToday: 1
        }
      )
    ).toEqual({
      growthTask: {
        key: "daily-care",
        points: 27,
        rewards: { mood: 8, energy: 4, intimacy: 15 }
      },
      careScoreRules: {
        dailyTaskBonus: 19,
        steadyMinScore: 60,
        thrivingMinScore: 70,
        thrivingRequiresCareToday: true
      }
    });
  });

  it("proves a care score used the configured daily bonus after stats changed", () => {
    expect(careScoreBaseFromStats({ mood: 80, energy: 72, intimacy: 25 })).toBe(59);
    expect(
      careScoreBonusFromProfile(
        {
          stats: { mood: 80, energy: 72, intimacy: 25 },
          growth: { careScore: 78 }
        },
        19
      )
    ).toBe(true);
    expect(
      careScoreBonusFromProfile(
        {
          stats: { mood: 80, energy: 72, intimacy: 25 },
          growth: { careScore: 71 }
        },
        19
      )
    ).toBe(false);
  });
});
