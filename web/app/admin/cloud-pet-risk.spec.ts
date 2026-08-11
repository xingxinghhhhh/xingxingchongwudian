import {
  compareCloudPetRisk,
  evaluateCloudPetRisk,
  getCloudPetRiskReasonCounts,
  getCloudPetRiskReasonLabel,
  matchesCloudPetRiskReason
} from "./cloud-pet-risk";

function createPet(overrides: Partial<Parameters<typeof evaluateCloudPetRisk>[0]> = {}) {
  return {
    growth: {
      isCareCompleteToday: true,
      careState: "steady" as const
    },
    homepageVisitCount: 1,
    communityPostCount: 1,
    ...overrides
  };
}

describe("cloud-pet risk evaluator", () => {
  it("keeps the existing reason conditions, levels, and order", () => {
    const result = evaluateCloudPetRisk(
      createPet({
        growth: { isCareCompleteToday: false, careState: "needs_care" },
        homepageVisitCount: 0,
        communityPostCount: 0
      })
    );

    expect(result).toMatchObject({
      count: 4,
      highestLevel: "high",
      summary: "今日照护未完成 / 需要照护 / 主页无访问 / 社区无内容"
    });
    expect(result.reasons.map((reason) => reason.code)).toEqual([
      "care_incomplete_today",
      "needs_care_state",
      "no_homepage_visits",
      "no_community_posts"
    ]);
  });

  it("returns no reasons for a healthy pet", () => {
    expect(evaluateCloudPetRisk(createPet())).toEqual({
      reasons: [],
      count: 0,
      highestLevel: "low",
      summary: "正常"
    });
  });

  it("keeps reason labels independent from stable codes", () => {
    expect(getCloudPetRiskReasonLabel("care_incomplete_today")).toBe(
      "今日照护未完成"
    );
  });

  it("preserves risk sorting precedence", () => {
    const high = createPet({ growth: { isCareCompleteToday: false, careState: "steady" } });
    const medium = createPet({ growth: { isCareCompleteToday: true, careState: "needs_care" } });
    const low = createPet();

    expect([low, medium, high].sort(compareCloudPetRisk)).toEqual([high, medium, low]);
  });

  it("filters by stable reason code without changing the evaluator", () => {
    const pet = createPet({
      growth: { isCareCompleteToday: false, careState: "steady" },
      homepageVisitCount: 0
    });

    expect(matchesCloudPetRiskReason(pet, "")).toBe(true);
    expect(matchesCloudPetRiskReason(pet, "care_incomplete_today")).toBe(true);
    expect(matchesCloudPetRiskReason(pet, "no_homepage_visits")).toBe(true);
    expect(matchesCloudPetRiskReason(pet, "no_community_posts")).toBe(false);
  });

  it("counts overlapping reasons from the same evaluator", () => {
    const counts = getCloudPetRiskReasonCounts([
      createPet({
        growth: { isCareCompleteToday: false, careState: "steady" },
        homepageVisitCount: 0
      }),
      createPet({
        growth: { isCareCompleteToday: true, careState: "needs_care" },
        homepageVisitCount: 0,
        communityPostCount: 0
      })
    ]);

    expect(counts).toEqual({
      care_incomplete_today: 1,
      needs_care_state: 1,
      no_homepage_visits: 2,
      no_community_posts: 1
    });
  });
});
