export type CloudPetPrismaSmokeState = {
  completedTaskKeys: string[];
  todayCompletedTaskCount: number;
  careScore: number;
  careState: string;
  careStreakDays: number;
  autoDiaryCount: number;
};

type CloudPetProfileLike = {
  growth?: {
    todayCompletedTaskKeys?: unknown;
    todayCompletedTaskCount?: unknown;
    careScore?: unknown;
    careState?: unknown;
    careStreakDays?: unknown;
  };
  timeline?: Array<{ type?: unknown }>;
};

export function canonicalizeCloudPetPrismaState(
  profile: CloudPetProfileLike
): CloudPetPrismaSmokeState {
  const completedTaskKeys = Array.isArray(profile.growth?.todayCompletedTaskKeys)
    ? profile.growth.todayCompletedTaskKeys.filter(
        (taskKey): taskKey is string => typeof taskKey === "string"
      )
    : [];
  const timeline = Array.isArray(profile.timeline) ? profile.timeline : [];

  return {
    completedTaskKeys: [...new Set(completedTaskKeys)].sort(),
    todayCompletedTaskCount: Number(profile.growth?.todayCompletedTaskCount ?? 0),
    careScore: Number(profile.growth?.careScore ?? 0),
    careState: String(profile.growth?.careState ?? ""),
    careStreakDays: Number(profile.growth?.careStreakDays ?? 0),
    autoDiaryCount: timeline.filter((event) => event.type === "daily_diary").length
  };
}

export function addUtcDays(date: string, dayDelta: number) {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + dayDelta);
  return next.toISOString().slice(0, 10);
}
