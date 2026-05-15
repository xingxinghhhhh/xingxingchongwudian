# Diary Archive Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the diary list page into a timeline-style archive with lightweight protagonist filtering for `全部 / 奶盖 / 年糕`.

**Architecture:** Keep the archive powered by local typed content data, add one small helper for filtered newest-first archive entries, and redesign only the `/diary` route plus supporting styles. Use URL query state on the same route so filters feel persistent without creating extra pages.

**Tech Stack:** Next.js App Router, React, TypeScript, Jest, global CSS

---

## File Structure

- `D:/AI/kzt/web/app/content-site-data.ts`
  - add archive filter type and helper
- `D:/AI/kzt/web/app/content-site-data.spec.ts`
  - add archive filtering coverage
- `D:/AI/kzt/web/app/diary/page.tsx`
  - redesign the archive page and wire filter state
- `D:/AI/kzt/web/app/globals.css`
  - add timeline and filter styles

### Task 1: Add archive filtering helper with failing tests first

**Files:**
- Modify: `D:/AI/kzt/web/app/content-site-data.spec.ts`
- Modify: `D:/AI/kzt/web/app/content-site-data.ts`

- [ ] **Step 1: Write the failing test**

Append to `D:/AI/kzt/web/app/content-site-data.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node_modules\.bin\jest.cmd --runInBand web/app/content-site-data.spec.ts`
Expected: FAIL because `getDiaryArchiveEntries` does not exist yet

- [ ] **Step 3: Write minimal implementation**

In `D:/AI/kzt/web/app/content-site-data.ts`, add:

```ts
export type DiaryArchiveFilter = "all" | "naigai" | "niangao";

export function getDiaryArchiveEntries(
  filter: DiaryArchiveFilter
): JournalEntry[] {
  if (filter === "all") {
    return getLatestJournalEntries(journalEntries, journalEntries.length);
  }

  return getJournalEntriesByPetId(filter);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node_modules\.bin\jest.cmd --runInBand web/app/content-site-data.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/app/content-site-data.ts web/app/content-site-data.spec.ts
git commit -m "feat: add diary archive filter helper"
```

### Task 2: Redesign the `/diary` page as a timeline archive

**Files:**
- Modify: `D:/AI/kzt/web/app/diary/page.tsx`

- [ ] **Step 1: Write the failing build change**

Update imports and route props in `D:/AI/kzt/web/app/diary/page.tsx` to use query-driven filtering:

```ts
import Link from "next/link";
import { ArrowRight, Heart } from "lucide-react";
import { SiteHeader } from "../components/site-header";
import {
  DiaryArchiveFilter,
  getDiaryArchiveEntries,
  pets
} from "../content-site-data";

type DiaryPageProps = {
  searchParams?: Promise<{
    pet?: string;
  }>;
};
```

- [ ] **Step 2: Run build to verify it fails**

Run: `node_modules\.bin\next.cmd build web`
Expected: FAIL until the new page implementation is complete

- [ ] **Step 3: Write minimal implementation**

Replace the page with a query-filtered archive:

```tsx
const resolvedSearchParams = searchParams ? await searchParams : undefined;
const requestedFilter = resolvedSearchParams?.pet;

const activeFilter: DiaryArchiveFilter =
  requestedFilter === "naigai" || requestedFilter === "niangao"
    ? requestedFilter
    : "all";

const entries = getDiaryArchiveEntries(activeFilter);

const filterItems = [
  { key: "all", label: "全部", href: "/diary" },
  { key: "naigai", label: "奶盖", href: "/diary?pet=naigai" },
  { key: "niangao", label: "年糕", href: "/diary?pet=niangao" }
] as const;
```

Use a structure like:

```tsx
<section className="page-hero">
  <div className="page-hero__inner">
    <p className="eyebrow">Diary archive</p>
    <h1>这里收着奶盖和年糕慢慢长大的时间线。</h1>
    <p className="page-hero__copy">
      每一篇日记都不算惊天动地，但连在一起，就会慢慢看见陪伴是怎么发生的。
    </p>
  </div>
</section>

<section className="section archive-shell">
  <div className="archive-filter" role="tablist" aria-label="Diary filters">
    {filterItems.map((item) => (
      <Link
        className={item.key === activeFilter ? "archive-filter__item archive-filter__item--active" : "archive-filter__item"}
        href={item.href}
        key={item.key}
      >
        {item.label}
      </Link>
    ))}
  </div>

  <div className="timeline">
    {entries.map((entry) => {
      const pet = pets.find((item) => item.id === entry.petId);

      return (
        <article className="timeline-entry" key={entry.id}>
          <div className="timeline-entry__rail">
            <span className="timeline-entry__dot" />
            <span className="timeline-entry__date">{entry.dateLabel}</span>
          </div>

          <div className="timeline-entry__card">
            <div className="timeline-entry__meta">
              <span className="chip chip--soft">{pet?.name ?? "记录"}</span>
              <span className="mood-pill">{entry.mood}</span>
            </div>
            <h2>{entry.title}</h2>
            <p>{entry.summary}</p>
            <div className="tag-row tag-row--profile">
              {entry.tags.map((tag) => (
                <span className="tag" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
            <Link className="text-link text-link--spaced" href={`/diary/${entry.id}`}>
              读完整记录
              <ArrowRight size={16} />
            </Link>
          </div>
        </article>
      );
    })}
  </div>
</section>
```

Include an empty state:

```tsx
{entries.length === 0 ? (
  <div className="detail-panel">
    <p className="detail-panel__copy">这一栏还没有新的记录，但奶盖和年糕很快会继续长出新的日常。</p>
  </div>
) : (
  <div className="timeline">...</div>
)}
```

- [ ] **Step 4: Run build to verify it passes**

Run: `node_modules\.bin\next.cmd build web`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/app/diary/page.tsx
git commit -m "feat: redesign diary archive as timeline"
```

### Task 3: Add timeline archive styles

**Files:**
- Modify: `D:/AI/kzt/web/app/globals.css`

- [ ] **Step 1: Write the failing styling step**

After the new `/diary` page structure is in place, verify that the page compiles before styles:

Run: `node_modules\.bin\next.cmd build web`
Expected: PASS, but layout still visually incomplete

- [ ] **Step 2: Write minimal implementation**

Append styles like:

```css
.archive-shell {
  display: grid;
  gap: 24px;
}

.archive-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.archive-filter__item {
  display: inline-flex;
  align-items: center;
  min-height: 38px;
  padding: 0 14px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--muted-strong);
  font-weight: 600;
}

.archive-filter__item--active {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}

.timeline {
  display: grid;
  gap: 22px;
}

.timeline-entry {
  display: grid;
  grid-template-columns: 148px minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

.timeline-entry__rail {
  display: grid;
  grid-template-columns: 16px 1fr;
  gap: 12px;
  align-items: start;
  padding-top: 26px;
}

.timeline-entry__dot {
  width: 12px;
  height: 12px;
  margin-top: 4px;
  border-radius: 999px;
  background: var(--accent);
  box-shadow: 0 0 0 6px rgba(199, 102, 71, 0.12);
}

.timeline-entry__date {
  color: var(--muted);
  font-size: 14px;
  font-weight: 600;
}

.timeline-entry__card {
  padding: 26px 28px;
  border: 1px solid var(--line);
  border-radius: 28px;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.timeline-entry__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
}

.timeline-entry__card h2 {
  margin: 0;
  font-size: 30px;
  line-height: 1.12;
}

.timeline-entry__card p {
  margin: 14px 0 0;
  color: var(--muted-strong);
  font-size: 18px;
  line-height: 1.75;
}
```

Add responsive support:

```css
@media (max-width: 900px) {
  .timeline-entry {
    grid-template-columns: 1fr;
  }

  .timeline-entry__rail {
    grid-template-columns: 16px 1fr;
    padding-top: 0;
  }
}
```

- [ ] **Step 3: Run build to verify it passes**

Run: `node_modules\.bin\next.cmd build web`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add web/app/globals.css
git commit -m "style: add diary archive timeline layout"
```

### Task 4: Verify the archive route locally

**Files:**
- No source changes required unless issues are found

- [ ] **Step 1: Check the archive route in default and filtered views**

Run:

```bash
powershell -Command "try { (Invoke-WebRequest -UseBasicParsing http://localhost:3001/diary).StatusCode } catch { $_.Exception.Message }"
powershell -Command "try { (Invoke-WebRequest -UseBasicParsing http://localhost:3001/diary?pet=naigai).StatusCode } catch { $_.Exception.Message }"
powershell -Command "try { (Invoke-WebRequest -UseBasicParsing http://localhost:3001/diary?pet=niangao).StatusCode } catch { $_.Exception.Message }"
```

Expected: all return `200`

- [ ] **Step 2: Re-run the required verifications**

Run:

```bash
node_modules\.bin\jest.cmd --runInBand web/app/content-site-data.spec.ts
node_modules\.bin\next.cmd build web
```

Expected:
- Jest output shows all tests passing
- Next build output shows `/diary` and `/diary/[entryId]` generated successfully

- [ ] **Step 3: Commit only if verification fixes were needed**

```bash
git add web/app/content-site-data.ts web/app/content-site-data.spec.ts web/app/diary/page.tsx web/app/globals.css
git commit -m "fix: polish diary archive timeline flow"
```
