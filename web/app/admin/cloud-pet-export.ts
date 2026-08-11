import type { AdminCloudPet } from "./admin-api";
import { getRiskLevelLabel, getStatusLabel } from "./admin-copy";
import { evaluateCloudPetRisk } from "./cloud-pet-risk";

export const cloudPetExportHeaders = [
  "宠物编号",
  "宠物名称",
  "宠物类型",
  "照护状态",
  "照护分",
  "连续照护天数",
  "风险等级",
  "风险原因",
  "主页访问数",
  "社区帖子数"
] as const;

export type CloudPetExportRow = Record<
  (typeof cloudPetExportHeaders)[number],
  string | number
>;

export function toCloudPetExportRow(pet: AdminCloudPet): CloudPetExportRow {
  const risk = evaluateCloudPetRisk(pet);

  return {
    宠物编号: pet.petNo,
    宠物名称: pet.name,
    宠物类型: pet.species,
    照护状态: getStatusLabel(pet.growth.careState),
    照护分: pet.growth.careScore,
    连续照护天数: pet.growth.careStreakDays,
    风险等级: getRiskLevelLabel(risk.highestLevel),
    风险原因: risk.summary,
    主页访问数: pet.homepageVisitCount ?? 0,
    社区帖子数: pet.communityPostCount
  };
}

export function escapeCloudPetCsvCell(value: string | number) {
  const text = String(value);
  const formulaSafeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${formulaSafeText.replaceAll('"', '""')}"`;
}

export function buildCloudPetCsv(pets: AdminCloudPet[]) {
  const rows = pets.map(toCloudPetExportRow);
  const lines = [
    cloudPetExportHeaders.map(escapeCloudPetCsvCell).join(","),
    ...rows.map((row) =>
      cloudPetExportHeaders.map((header) => escapeCloudPetCsvCell(row[header])).join(",")
    )
  ];

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
