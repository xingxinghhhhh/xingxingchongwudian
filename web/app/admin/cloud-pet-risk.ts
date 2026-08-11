export type CloudPetRiskLevel = "high" | "medium" | "low";

export type CloudPetRiskReasonCode =
  | "care_incomplete_today"
  | "needs_care_state"
  | "no_homepage_visits"
  | "no_community_posts";

export type CloudPetRiskInput = {
  growth: {
    isCareCompleteToday: boolean;
    careState: "needs_care" | "steady" | "thriving";
  };
  homepageVisitCount?: number;
  communityPostCount: number;
};

export type CloudPetRiskReason = {
  code: CloudPetRiskReasonCode;
  level: CloudPetRiskLevel;
  label: string;
};

export type CloudPetRiskEvaluation = {
  reasons: CloudPetRiskReason[];
  count: number;
  highestLevel: CloudPetRiskLevel;
  summary: string;
};

const reasonLabels: Record<CloudPetRiskReasonCode, string> = {
  care_incomplete_today: "今日照护未完成",
  needs_care_state: "需要照护",
  no_homepage_visits: "主页无访问",
  no_community_posts: "社区无内容"
};

const reasonDefinitions: Array<{
  code: CloudPetRiskReasonCode;
  level: CloudPetRiskLevel;
  matches: (pet: CloudPetRiskInput) => boolean;
}> = [
  {
    code: "care_incomplete_today",
    level: "high",
    matches: (pet) => !pet.growth.isCareCompleteToday
  },
  {
    code: "needs_care_state",
    level: "medium",
    matches: (pet) => pet.growth.careState === "needs_care"
  },
  {
    code: "no_homepage_visits",
    level: "medium",
    matches: (pet) => (pet.homepageVisitCount ?? 0) === 0
  },
  {
    code: "no_community_posts",
    level: "low",
    matches: (pet) => pet.communityPostCount === 0
  }
];

export function getCloudPetRiskReasonLabel(code: CloudPetRiskReasonCode) {
  return reasonLabels[code];
}

export function evaluateCloudPetRisk(
  pet: CloudPetRiskInput
): CloudPetRiskEvaluation {
  const reasons = reasonDefinitions
    .filter((definition) => definition.matches(pet))
    .map((definition) => ({
      code: definition.code,
      level: definition.level,
      label: getCloudPetRiskReasonLabel(definition.code)
    }));
  const highestLevel = reasons.some((reason) => reason.level === "high")
    ? "high"
    : reasons.some((reason) => reason.level === "medium")
      ? "medium"
      : "low";

  return {
    reasons,
    count: reasons.length,
    highestLevel,
    summary: reasons.length > 0 ? reasons.map((reason) => reason.label).join(" / ") : "正常"
  };
}

export function compareCloudPetRisk(
  left: CloudPetRiskInput,
  right: CloudPetRiskInput
) {
  const leftRisk = evaluateCloudPetRisk(left);
  const rightRisk = evaluateCloudPetRisk(right);
  const levelDelta =
    getCloudPetRiskWeight(rightRisk.highestLevel) -
    getCloudPetRiskWeight(leftRisk.highestLevel);

  return levelDelta !== 0 ? levelDelta : rightRisk.count - leftRisk.count;
}

function getCloudPetRiskWeight(level: CloudPetRiskLevel) {
  if (level === "high") {
    return 3;
  }

  if (level === "medium") {
    return 2;
  }

  return 1;
}
