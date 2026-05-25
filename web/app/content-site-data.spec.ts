import {
  accountName,
  accountTagline,
  aboutChapters,
  getAdjacentJournalEntries,
  getDiaryArchiveEntries,
  getJournalEntriesByPetId,
  getJournalEntryById,
  getLatestJournalEntries,
  getPetById,
  journalEntries,
  pets,
  socialBios,
  worldSummary
} from "./content-site-data";

describe("content site data", () => {
  it("keeps both protagonists in the cast", () => {
    expect(pets).toHaveLength(2);
    expect(new Set(pets.map((pet) => pet.type))).toEqual(new Set(["cat", "dog"]));
    expect(pets.map((pet) => pet.name)).toEqual(["奶盖", "年糕"]);
    expect(pets[0]?.temperament).toContain("傲娇");
    expect(pets[1]?.breedLabel).toBe("浅棕白色柯基幼犬");
    expect(pets.map((pet) => pet.heroImage)).toEqual([
      "/brand/naigai-niangao/naigai-standard.png",
      "/brand/naigai-niangao/niangao-standard.png"
    ]);
  });

  it("returns the latest diary entries first", () => {
    const latest = getLatestJournalEntries(journalEntries, 3);

    expect(latest).toHaveLength(3);
    expect(latest.map((entry) => entry.id)).toEqual([
      "entry-05",
      "entry-04",
      "entry-03"
    ]);
  });

  it("uses the approved brand naming and world summary", () => {
    expect(accountName).toBe("奶盖和年糕的 AI 成长日记");
    expect(worldSummary).toContain("原木风小家");
    expect(accountTagline).toBe("记录奶盖和年糕一起长大的日常，也记录陪伴是怎么慢慢发生的。");
  });

  it("finds pet and diary content by id", () => {
    expect(getPetById("naigai")?.name).toBe("奶盖");
    expect(getPetById("niangao")?.name).toBe("年糕");
    expect(getPetById("missing")).toBeUndefined();

    expect(getJournalEntryById("entry-03")?.petId).toBe("naigai");
    expect(getJournalEntryById("missing")).toBeUndefined();
  });

  it("filters one pet's diary entries from newest to oldest", () => {
    const naigaiEntries = getJournalEntriesByPetId("naigai");
    const niangaoEntries = getJournalEntriesByPetId("niangao");

    expect(naigaiEntries.map((entry) => entry.id)).toEqual([
      "entry-05",
      "entry-03",
      "entry-01"
    ]);
    expect(niangaoEntries.map((entry) => entry.id)).toEqual([
      "entry-04",
      "entry-02"
    ]);
  });

  it("keeps the about-page story and social bios aligned", () => {
    expect(aboutChapters).toHaveLength(3);
    expect(aboutChapters[0]?.title).toContain("为什么开始记录");
    expect(socialBios.douyin).toContain("傲娇小猫");
    expect(socialBios.xiaohongshu).toContain("原木风小家");
  });

  it("stores editorial content fields on each diary entry", () => {
    const entry = getJournalEntryById("entry-03");

    expect(entry?.subtitle).toContain("偷偷");
    expect(entry?.intro.length).toBeGreaterThan(20);
    expect(entry?.sections).toHaveLength(3);
    expect(entry?.sections[0]?.heading.length).toBeGreaterThan(1);
    expect(entry?.closingNote.length).toBeGreaterThan(10);
  });

  it("finds the previous and next diary entries by date order", () => {
    expect(getAdjacentJournalEntries("entry-03")).toEqual({
      previous: expect.objectContaining({ id: "entry-04" }),
      next: expect.objectContaining({ id: "entry-02" })
    });

    expect(getAdjacentJournalEntries("entry-05")).toEqual({
      previous: undefined,
      next: expect.objectContaining({ id: "entry-04" })
    });

    expect(getAdjacentJournalEntries("entry-01")).toEqual({
      previous: expect.objectContaining({ id: "entry-02" }),
      next: undefined
    });
  });

  it("builds archive views for all, naigai, and niangao", () => {
    expect(getDiaryArchiveEntries("all").map((entry) => entry.id)).toEqual([
      "entry-05",
      "entry-04",
      "entry-03",
      "entry-02",
      "entry-01"
    ]);

    expect(getDiaryArchiveEntries("naigai").map((entry) => entry.id)).toEqual([
      "entry-05",
      "entry-03",
      "entry-01"
    ]);

    expect(getDiaryArchiveEntries("niangao").map((entry) => entry.id)).toEqual([
      "entry-04",
      "entry-02"
    ]);
  });
});
