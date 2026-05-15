# Diary Archive Timeline Design

**Project:** Timeline-style diary archive page for `奶盖和年糕的 AI 成长日记`

**Goal**

Upgrade the diary list page from a simple grid of cards into a true archive experience that feels like an ongoing record of growth. The page should help visitors understand that the site is continuously updated and make it easy to follow either both protagonists together or one protagonist at a time.

## Scope

This slice upgrades only the diary archive page and the data helpers that support archive filtering.

Included:

- archive-style page introduction
- `全部 / 奶盖 / 年糕` filter model
- reverse-chronological timeline presentation
- clear emotional and protagonist labeling
- archive-oriented layout instead of generic card wall

Not included:

- search
- tags-as-navigation
- year/month archive grouping
- infinite scroll
- comments
- CMS tooling

## Recommended Approach

Use a **shared chronological timeline with explicit protagonist filters**.

That means:

1. default view shows all entries in reverse date order,
2. each entry clearly identifies whether it belongs to 奶盖 or 年糕,
3. users can switch to a single-pet view with one tap,
4. visual structure emphasizes continuity over merchandising or card density.

This is the best balance for the site right now because there are only two protagonists and the strongest signal we want is “this account keeps growing over time.”

## Information Architecture

### Top introduction

The page should open with:

- a small archive label
- a clear H1 explaining this is the ongoing diary archive
- one short paragraph about how these entries record daily changes, small emotions, and growing familiarity

### Filter bar

Add a compact filter control with:

- 全部
- 奶盖
- 年糕

The filter should feel like a calm content navigation control, not a dashboard tab strip.

### Timeline body

Each item in the archive should show:

- date
- protagonist name
- mood
- title
- summary
- tags
- link to the full entry

The page should read as an unfolding timeline, not a marketplace grid.

### Bottom continuation

The bottom of the archive can include simple onward navigation such as:

- back to profiles
- back to about
- continue to the latest single entry

## Data Model Changes

No large structural change is required.

Add small helpers around the existing `journalEntries` collection:

- `getJournalEntriesByPetId`
  - already exists and should continue to be used
- `getDiaryArchiveEntries(filter)`
  - can return all entries or filtered entries while keeping reverse chronological ordering

If this helper is unnecessary after implementation review, it can be skipped and derived inline from existing helpers. YAGNI applies.

## Visual Direction

The page should feel:

- archival
- calm
- editorial
- easy to keep scrolling

Use:

- a narrower rhythm than the homepage
- visible time markers
- protagonist chips
- enough spacing for entries to breathe
- fewer “boxed card” cues than the current list page

The goal is a reading archive, not a promo surface.

## Interaction Behavior

- Default filter is `全部`
- Clicking `奶盖` shows only 奶盖 entries
- Clicking `年糕` shows only 年糕 entries
- Switching filters should not navigate away; it should update the archive view in place
- The currently selected filter must be visually obvious

## Error Handling

- If a filter yields no entries, show a short calm empty-state message instead of blank space
- If content data is present, the page should never depend on API calls

## Testing

Add coverage for:

- all entries returned in newest-first order
- filtered entries returned only for the selected protagonist
- archive helper behavior if a helper is added

Verify with:

- `node_modules\.bin\jest.cmd --runInBand web/app/content-site-data.spec.ts`
- `node_modules\.bin\next.cmd build web`
- local route check for `/diary`

## Success Criteria

- visitors can immediately tell the site is actively recording a continuing story
- the archive is easier to browse than the previous card wall
- filtering by 奶盖 or 年糕 feels natural and lightweight
- the page tone matches the rest of the site
