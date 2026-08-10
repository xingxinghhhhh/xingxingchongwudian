export const DAILY_DIARY_EVENT_TYPES = [
  "daily_diary",
  "care_daily_diary",
  "presence_daily_diary"
] as const;

export type CloudPetDiaryEventType = (typeof DAILY_DIARY_EVENT_TYPES)[number];

export function isCloudPetDiaryEventType(type: string) {
  return (DAILY_DIARY_EVENT_TYPES as readonly string[]).includes(type);
}
