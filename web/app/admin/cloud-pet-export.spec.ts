import type { AdminCloudPet } from "./admin-api";
import {
  buildCloudPetCsv,
  escapeCloudPetCsvCell,
  toCloudPetExportRow
} from "./cloud-pet-export";

function makePet(input: Partial<AdminCloudPet> = {}) {
  return {
    petNo: "VP_EXPORT_001",
    ownerName: "Private Owner",
    ownerPhone: "13800000000",
    name: "Milo",
    species: "cat" as const,
    personality: "Private personality",
    avatarUrl: "",
    bio: "Private bio",
    stats: { mood: 50, energy: 50, intimacy: 50 },
    growth: {
      level: 2,
      levelLabel: "Level 2",
      experiencePoints: 20,
      nextLevelExperience: 50,
      progressPercent: 40,
      careState: "steady" as const,
      careScore: 72,
      todayCompletedTaskCount: 4,
      todayCompletedTaskKeys: [],
      isCareCompleteToday: true,
      careStreakDays: 3,
      nextCarePrompt: "Keep going"
    },
    homepage: {
      theme: "sunny" as const,
      headline: "Private headline",
      ownerStory: "Private story",
      showGrowthArchive: true,
      showMallRecommendations: true
    },
    timeline: [],
    communityPostCount: 2,
    homepageVisitCount: 5,
    ...input
  } as AdminCloudPet;
}

describe("cloud-pet CSV export", () => {
  it("projects only safe fields in the supplied pet order", () => {
    const first = makePet({ petNo: "VP_EXPORT_001", name: "First" });
    const second = makePet({ petNo: "VP_EXPORT_002", name: "Second" });

    const csv = buildCloudPetCsv([first, second]);

    expect(csv.indexOf("VP_EXPORT_001")).toBeLessThan(csv.indexOf("VP_EXPORT_002"));
    expect(csv).toContain("宠物编号");
    expect(csv).toContain("First");
    expect(csv).toContain("Second");
    expect(csv).not.toContain("Private Owner");
    expect(csv).not.toContain("13800000000");
    expect(csv).not.toContain("Private personality");
    expect(csv).not.toContain("Private story");
  });

  it("escapes CSV syntax and prevents formula interpretation", () => {
    expect(escapeCloudPetCsvCell("a,b\"c\nd")).toBe('"a,b""c\nd"');
    expect(escapeCloudPetCsvCell("=HYPERLINK(\"https://example.test\")")).toBe(
      '"\'=HYPERLINK(""https://example.test"")"'
    );
    expect(escapeCloudPetCsvCell(" +1")).toBe('"\' +1"');
  });

  it("derives risk fields from the existing evaluator", () => {
    const row = toCloudPetExportRow(
      makePet({
        growth: {
          ...makePet().growth,
          isCareCompleteToday: false,
          careState: "needs_care"
        }
      })
    );

    expect(row["照护分"]).toBe(72);
    expect(row["主页访问数"]).toBe(5);
    expect(row["社区帖子数"]).toBe(2);
    expect(row["风险原因"]).toContain("今日照护未完成");
  });
});
