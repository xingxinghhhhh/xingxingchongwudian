# Diary Detail Editorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade each diary detail page into a premium editorial reading experience with richer content structure and better navigation.

**Architecture:** Keep content local and typed in `content-site-data.ts`, extend the diary entry model just enough to support a real article layout, and redesign only the diary detail route plus the small helper functions it depends on. Reuse the existing site shell, keep list pages mostly stable, and make navigation between entries feel continuous.

**Tech Stack:** Next.js App Router, React, TypeScript, Jest, global CSS

---

## File Structure

- `D:/AI/kzt/web/app/content-site-data.ts`
  - Extend `JournalEntry`
  - Add per-entry article fields
  - Add previous/next lookup helpers
- `D:/AI/kzt/web/app/content-site-data.spec.ts`
  - Cover richer diary content and navigation helpers
- `D:/AI/kzt/web/app/diary/[entryId]/page.tsx`
  - Replace simple detail layout with editorial article layout
- `D:/AI/kzt/web/app/globals.css`
  - Add article typography and article navigation styles

### Task 1: Extend diary data and helper functions

**Files:**
- Modify: `D:/AI/kzt/web/app/content-site-data.spec.ts`
- Modify: `D:/AI/kzt/web/app/content-site-data.ts`

- [ ] **Step 1: Write the failing test**

Update `D:/AI/kzt/web/app/content-site-data.spec.ts` by adding:

```ts
import {
  accountName,
  accountTagline,
  aboutChapters,
  getAdjacentJournalEntries,
  getJournalEntriesByPetId,
  getJournalEntryById,
  getLatestJournalEntries,
  getPetById,
  journalEntries,
  pets,
  socialBios,
  worldSummary
} from "./content-site-data";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node_modules\.bin\jest.cmd --runInBand web/app/content-site-data.spec.ts`
Expected: FAIL with missing `subtitle`, `sections`, `closingNote`, or `getAdjacentJournalEntries`

- [ ] **Step 3: Write minimal implementation**

Update `D:/AI/kzt/web/app/content-site-data.ts` with:

```ts
export type JournalSection = {
  heading: string;
  body: string;
};

export type JournalEntry = {
  id: string;
  petId: string;
  title: string;
  subtitle: string;
  dateLabel: string;
  sortDate: string;
  mood: string;
  heroTone: string;
  summary: string;
  intro: string;
  sections: JournalSection[];
  closingNote: string;
  tags: string[];
};
```

And add:

```ts
export function getAdjacentJournalEntries(entryId: string): {
  previous: JournalEntry | undefined;
  next: JournalEntry | undefined;
} {
  const ordered = getLatestJournalEntries(journalEntries, journalEntries.length);
  const index = ordered.findIndex((entry) => entry.id === entryId);

  if (index === -1) {
    return { previous: undefined, next: undefined };
  }

  return {
    previous: ordered[index - 1],
    next: ordered[index + 1]
  };
}
```

Also extend every journal entry object with:

```ts
subtitle: "一行情绪副标题",
heroTone: "warm",
intro: "一段导语",
sections: [
  { heading: "小标题一", body: "正文一" },
  { heading: "小标题二", body: "正文二" },
  { heading: "小标题三", body: "正文三" }
],
closingNote: "结尾一句"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node_modules\.bin\jest.cmd --runInBand web/app/content-site-data.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/app/content-site-data.ts web/app/content-site-data.spec.ts
git commit -m "feat: enrich diary entry content data"
```

### Task 2: Redesign the diary detail route as an editorial article

**Files:**
- Modify: `D:/AI/kzt/web/app/diary/[entryId]/page.tsx`

- [ ] **Step 1: Write the failing test**

Use the build as the failure gate by importing the new helper in the route before the full implementation is complete:

```ts
import {
  getAdjacentJournalEntries,
  getJournalEntryById,
  getJournalEntriesByPetId,
  getPetById,
  journalEntries
} from "../../content-site-data";
```

- [ ] **Step 2: Run build to verify it fails**

Run: `node_modules\.bin\next.cmd build web`
Expected: FAIL until `D:/AI/kzt/web/app/diary/[entryId]/page.tsx` matches the new entry shape

- [ ] **Step 3: Write minimal implementation**

Replace the page body with:

```tsx
const { previous, next } = getAdjacentJournalEntries(entry.id);

<section className="article-hero">
  <div className="article-hero__inner">
    <Link className="back-link" href="/diary">
      <ArrowLeft size={16} />
      返回日记列表
    </Link>
    <p className="eyebrow">{pet ? `${pet.name} · ${entry.dateLabel}` : entry.dateLabel}</p>
    <h1>{entry.title}</h1>
    <p className="article-hero__subtitle">{entry.subtitle}</p>
  </div>
</section>

<section className="section article-layout">
  <article className="article-body">
    <p className="article-body__intro">{entry.intro}</p>
    {entry.sections.map((section) => (
      <section className="article-section" key={section.heading}>
        <h2>{section.heading}</h2>
        <p>{section.body}</p>
      </section>
    ))}
    <p className="article-body__closing">{entry.closingNote}</p>
  </article>

  <aside className="article-aside">
    <div className="detail-panel">
      <span className="mood-pill">{entry.mood}</span>
      <div className="tag-row tag-row--profile">
        {entry.tags.map((tag) => (
          <span className="tag" key={tag}>
            {tag}
          </span>
        ))}
      </div>
    </div>

    <div className="detail-panel">
      <p className="section__kicker">More from this pet</p>
      <div className="stack-list">
        {relatedEntries.map((relatedEntry) => (
          <Link className="stack-item" href={`/diary/${relatedEntry.id}`} key={relatedEntry.id}>
            <div>
              <strong>{relatedEntry.title}</strong>
              <p>{relatedEntry.summary}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  </aside>
</section>

<section className="section article-pagination">
  {previous ? <Link href={`/diary/${previous.id}`}>上一篇：{previous.title}</Link> : <span />}
  {next ? <Link href={`/diary/${next.id}`}>下一篇：{next.title}</Link> : <span />}
</section>
```

Also keep the profile link near the bottom if `pet` exists.

- [ ] **Step 4: Run build to verify it passes**

Run: `node_modules\.bin\next.cmd build web`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/app/diary/[entryId]/page.tsx
git commit -m "feat: redesign diary detail as editorial page"
```

### Task 3: Add article layout styles

**Files:**
- Modify: `D:/AI/kzt/web/app/globals.css`

- [ ] **Step 1: Write the failing test**

Use the build as the verification gate after adding the new class names in the diary detail route. The page will compile but remain visually incomplete until styles are added.

- [ ] **Step 2: Run build to verify the code compiles before styling**

Run: `node_modules\.bin\next.cmd build web`
Expected: PASS

- [ ] **Step 3: Write minimal implementation**

Append styles like:

```css
.article-hero {
  padding: 56px 24px 0;
}

.article-hero__inner {
  max-width: 920px;
  margin: 0 auto;
  padding: 44px 0 0;
}

.article-hero__subtitle {
  max-width: 720px;
  margin: 20px 0 0;
  color: var(--muted-strong);
  font-size: 22px;
  line-height: 1.65;
}

.article-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(280px, 0.8fr);
  gap: 24px;
}

.article-body {
  min-width: 0;
  padding: 12px 0 0;
}

.article-body__intro,
.article-section p,
.article-body__closing {
  max-width: 720px;
  color: var(--muted-strong);
  font-size: 19px;
  line-height: 1.9;
}

.article-section + .article-section {
  margin-top: 32px;
}

.article-section h2 {
  margin: 0 0 14px;
  font-size: 26px;
  line-height: 1.2;
}

.article-body__closing {
  margin-top: 36px;
  font-style: italic;
}

.article-aside {
  display: grid;
  gap: 18px;
  align-self: start;
}

.article-pagination {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}
```

Add responsive fallbacks in the existing media queries:

```css
.article-layout,
.article-pagination {
  grid-template-columns: 1fr;
}
```

- [ ] **Step 4: Run build to verify it passes**

Run: `node_modules\.bin\next.cmd build web`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/app/globals.css
git commit -m "style: add editorial diary article layout"
```

### Task 4: Verify route behavior locally

**Files:**
- No source changes required unless issues are found

- [ ] **Step 1: Check the upgraded route and a neighboring page**

Run:

```bash
powershell -Command "try { (Invoke-WebRequest -UseBasicParsing http://localhost:3001/diary/entry-03).StatusCode } catch { $_.Exception.Message }"
powershell -Command "try { (Invoke-WebRequest -UseBasicParsing http://localhost:3001/diary/entry-04).StatusCode } catch { $_.Exception.Message }"
```

Expected: both return `200`

- [ ] **Step 2: Re-run the full required verifications**

Run:

```bash
node_modules\.bin\jest.cmd --runInBand web/app/content-site-data.spec.ts
node_modules\.bin\next.cmd build web
```

Expected:
- Jest output shows all tests passing
- Next build output shows `/diary/[entryId]` pages generated successfully

- [ ] **Step 3: Commit only if verification fixes were needed**

```bash
git add web/app/content-site-data.ts web/app/content-site-data.spec.ts web/app/diary/[entryId]/page.tsx web/app/globals.css
git commit -m "fix: polish editorial diary detail flow"
```
