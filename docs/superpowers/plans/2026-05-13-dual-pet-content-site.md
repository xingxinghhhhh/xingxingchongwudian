# Dual Pet Content Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current storefront-style homepage with a dual-protagonist pet content homepage focused on profile and diary storytelling.

**Architecture:** Move the homepage to static typed content data that is rendered into a story-led landing page. Keep the backend untouched, preserve future extensibility for commerce and cloud-pet features, and simplify the page so the first release can build and preview reliably.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind v4 global CSS, Jest

---

### Task 1: Add typed content data and test its behavior

**Files:**
- Create: `D:/AI/kzt/web/app/content-site-data.ts`
- Create: `D:/AI/kzt/web/app/content-site-data.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { getLatestJournalEntries, journalEntries, pets } from "./content-site-data";

describe("content site data", () => {
  it("keeps both protagonists in the cast", () => {
    expect(pets).toHaveLength(2);
    expect(new Set(pets.map((pet) => pet.type))).toEqual(new Set(["cat", "dog"]));
  });

  it("returns the latest diary entries first", () => {
    const latest = getLatestJournalEntries(journalEntries, 3);
    expect(latest).toHaveLength(3);
    expect(latest.map((entry) => entry.id)).toEqual(["entry-05", "entry-04", "entry-03"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- web/app/content-site-data.spec.ts`
Expected: FAIL because `content-site-data` does not exist yet

- [ ] **Step 3: Write minimal implementation**

Create a typed data module exporting:
- `pets`
- `journalEntries`
- `storyChapters`
- `favoriteMoments`
- `getLatestJournalEntries(entries, count)`

Use sortable ISO-like `sortDate` values to make the helper deterministic.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- web/app/content-site-data.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/app/content-site-data.ts web/app/content-site-data.spec.ts
git commit -m "test: add dual pet content data module"
```

### Task 2: Rewrite homepage structure around the dual-pet story

**Files:**
- Modify: `D:/AI/kzt/web/app/page.tsx`

- [ ] **Step 1: Write the failing test**

Use the existing build as the failure gate by introducing imports from the new content module in the page before implementation is complete.

- [ ] **Step 2: Run build to verify it fails**

Run: `npm run web:build`
Expected: FAIL until the new page compiles against the content data module correctly

- [ ] **Step 3: Write minimal implementation**

Replace storefront behavior with these sections:
- sticky nav
- hero
- dual profile cards
- story chapters
- recent diary grid
- favorite moments
- future roadmap

Remove cart, payment, admin, and API-fetching logic from the homepage.

- [ ] **Step 4: Run build to verify it passes**

Run: `npm run web:build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/app/page.tsx
git commit -m "feat: turn homepage into dual pet story site"
```

### Task 3: Refresh metadata and global styles

**Files:**
- Modify: `D:/AI/kzt/web/app/layout.tsx`
- Modify: `D:/AI/kzt/web/app/globals.css`

- [ ] **Step 1: Write the failing test**

Use the build as the verification gate after introducing new class names in `page.tsx` that still need styling.

- [ ] **Step 2: Run build to verify it still compiles while the page is visually incomplete**

Run: `npm run web:build`
Expected: PASS, with visual work still pending

- [ ] **Step 3: Write minimal implementation**

Update metadata to match the new content-site identity and rewrite global CSS to support:
- editorial hero
- two-column profile cards
- chapter cards
- diary cards
- roadmap cards
- responsive mobile layout

- [ ] **Step 4: Run build to verify it passes**

Run: `npm run web:build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/app/layout.tsx web/app/globals.css
git commit -m "style: add warm editorial content-site theme"
```

### Task 4: Verify locally in browser

**Files:**
- No source changes required unless issues are found

- [ ] **Step 1: Start the frontend dev server**

Run: `npm run web:dev`
Expected: local site available at `http://localhost:3001`

- [ ] **Step 2: Open the page in the local browser**

Inspect:
- headline fit
- section spacing
- mobile stacking
- visual hierarchy
- whether the page reads as a content brand rather than a store

- [ ] **Step 3: Fix any issues found**

Modify only the relevant homepage or CSS files.

- [ ] **Step 4: Rebuild to verify final state**

Run: `npm run web:build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/app/page.tsx web/app/globals.css web/app/layout.tsx
git commit -m "fix: polish dual pet content site layout"
```
