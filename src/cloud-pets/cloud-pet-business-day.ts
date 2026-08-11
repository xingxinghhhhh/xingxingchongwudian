const CLOUD_PET_DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * UTC is the existing cloud-pet business-day contract. Changing it is a
 * product migration, not a runtime configuration concern for this helper.
 */
export function getCloudPetBusinessDateKey(
  instant: Date | string = new Date()
) {
  const date = instant instanceof Date ? instant : new Date(instant);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid cloud-pet business-day instant");
  }

  return date.toISOString().slice(0, 10);
}

export function getCloudPetBusinessDayRange(dateKey: string) {
  if (!CLOUD_PET_DATE_KEY_PATTERN.test(dateKey)) {
    throw new Error("Cloud-pet business date must use YYYY-MM-DD");
  }

  const start = new Date(`${dateKey}T00:00:00.000Z`);

  if (Number.isNaN(start.getTime())) {
    throw new Error("Invalid cloud-pet business date");
  }

  if (start.toISOString().slice(0, 10) !== dateKey) {
    throw new Error("Invalid cloud-pet business date");
  }

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return { start, end };
}

export function addCloudPetBusinessDays(dateKey: string, days: number) {
  if (!Number.isInteger(days)) {
    throw new Error("Cloud-pet business-day offset must be an integer");
  }

  const { start } = getCloudPetBusinessDayRange(dateKey);
  start.setUTCDate(start.getUTCDate() + days);
  return start.toISOString().slice(0, 10);
}
