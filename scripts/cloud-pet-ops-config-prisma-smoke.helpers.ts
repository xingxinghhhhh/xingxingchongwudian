export type CloudPetOpsConfigSnapshot = {
  growthTask: {
    key: string;
    points: number;
    rewards: {
      mood: number;
      energy: number;
      intimacy: number;
    };
  };
  careScoreRules: {
    dailyTaskBonus: number;
    steadyMinScore: number;
    thrivingMinScore: number;
    thrivingRequiresCareToday: boolean;
  };
};

type GrowthTaskLike = {
  key?: unknown;
  points?: unknown;
  rewards?: {
    mood?: unknown;
    energy?: unknown;
    intimacy?: unknown;
  };
};

type CareScoreRulesLike = {
  dailyTaskBonus?: unknown;
  steadyMinScore?: unknown;
  thrivingMinScore?: unknown;
  thrivingRequiresCareToday?: unknown;
};

export function canonicalizeCloudPetOpsConfig(
  growthTask: GrowthTaskLike,
  careScoreRules: CareScoreRulesLike
): CloudPetOpsConfigSnapshot {
  return {
    growthTask: {
      key: String(growthTask.key ?? ""),
      points: Number(growthTask.points ?? 0),
      rewards: {
        mood: Number(growthTask.rewards?.mood ?? 0),
        energy: Number(growthTask.rewards?.energy ?? 0),
        intimacy: Number(growthTask.rewards?.intimacy ?? 0)
      }
    },
    careScoreRules: {
      dailyTaskBonus: Number(careScoreRules.dailyTaskBonus ?? 0),
      steadyMinScore: Number(careScoreRules.steadyMinScore ?? 0),
      thrivingMinScore: Number(careScoreRules.thrivingMinScore ?? 0),
      thrivingRequiresCareToday: Boolean(
        careScoreRules.thrivingRequiresCareToday
      )
    }
  };
}

export function careScoreBaseFromStats(stats: {
  mood?: unknown;
  energy?: unknown;
  intimacy?: unknown;
}) {
  return Math.round(
    (Number(stats.mood ?? 0) +
      Number(stats.energy ?? 0) +
      Number(stats.intimacy ?? 0)) /
      3
  );
}

export function careScoreBonusFromProfile(
  profile: {
    growth?: { careScore?: unknown };
    stats?: { mood?: unknown; energy?: unknown; intimacy?: unknown };
  },
  expectedBonus: number
) {
  const careScore = Number(profile.growth?.careScore ?? 0);
  const baseScore = careScoreBaseFromStats(profile.stats ?? {});
  return careScore - baseScore === expectedBonus;
}
