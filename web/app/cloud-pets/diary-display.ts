export type CloudPetDiaryDisplay = {
  label: string;
  explanation?: string;
  representsCareCompletion: boolean;
};

export function isCloudPetDiaryEvent(type: string) {
  return [
    "daily_diary",
    "care_daily_diary",
    "presence_daily_diary"
  ].includes(type);
}

export function shouldShowTodayCareDiaryCta(input: {
  completedTaskCount: number;
  diaryType: string | null;
}) {
  return input.completedTaskCount > 0 && input.diaryType === "care_daily_diary";
}

export function resolveCloudPetDiaryDisplay(type: string): CloudPetDiaryDisplay {
  if (type === "owner_note") {
    return { label: "主人手记", representsCareCompletion: false };
  }

  if (type === "care_daily_diary") {
    return { label: "照顾记录", representsCareCompletion: true };
  }

  if (type === "presence_daily_diary") {
    return {
      label: "当日补记",
      explanation: "当天没有完成新的照顾任务，此记录仅用于补齐当天日记。",
      representsCareCompletion: false
    };
  }

  return { label: "日常记录", representsCareCompletion: false };
}
