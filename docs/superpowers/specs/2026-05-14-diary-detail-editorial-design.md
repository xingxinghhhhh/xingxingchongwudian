# Diary Detail Editorial Design

**Project:** Editorial upgrade for the single diary entry page

**Goal**

Turn the current diary detail page into a true reading experience for `奶盖和年糕的 AI 成长日记`, so a visitor coming from Douyin or Xiaohongshu lands on a page that feels like an ongoing content publication instead of a simple card detail.

## Scope

This slice only upgrades the diary entry experience and the data that supports it.

Included:

- richer diary entry content structure
- editorial diary detail layout
- previous / next entry navigation
- related entries by the same pet
- stronger emotional framing for each diary page

Not included:

- CMS or admin editing
- comments
- real photo galleries
- paid member gating
- homepage redesign

## Recommended Approach

Use an **editorial page with light structured content data**.

That means:

1. keep the content static and local for now,
2. expand each diary entry from one summary field into a small content object,
3. redesign only the diary detail page to read like a real article,
4. keep list pages and other sections mostly stable.

This gives us a visible quality jump today without prematurely building a CMS.

## Page Experience

Each diary detail page should have:

1. **Hero header**
   - date
   - pet name
   - emotional subtitle
   - article title

2. **Lead section**
   - one short intro paragraph that sets the scene

3. **Story body**
   - 2 to 3 sections
   - each section has a small heading and a paragraph
   - tone should mix story feeling and observed detail

4. **Closing note**
   - one soft final sentence that feels like a journal sign-off

5. **Context rail / lower section**
   - emotion tag
   - related entries from the same pet
   - previous / next article navigation
   - link back to the pet profile

## Data Model Changes

Extend `JournalEntry` with fields like:

- `subtitle`
- `intro`
- `sections`
  - `heading`
  - `body`
- `closingNote`
- `heroTone`

Keep the existing summary, tags, mood, and dates because list pages still depend on them.

This structure is enough for today and maps cleanly to a future CMS or paid cloud-pet content model.

## Visual Direction

The page should feel:

- warmer and more editorial than the current card view
- closer to a premium story post than a dashboard detail screen
- calm, readable, and emotionally anchored

Use:

- larger top spacing
- narrower reading column for body copy
- stronger typography contrast
- restrained secondary panels for related reading

## Navigation Behavior

Each article should offer:

- back to diary list
- previous entry
- next entry
- more entries from the same pet
- link to the corresponding pet profile

If previous or next does not exist, hide that specific link instead of showing empty UI.

## Testing

Add data-level tests for:

- previous / next entry lookup
- related entries by pet
- richer fields existing on upgraded diary entries

Then verify:

- `npm test -- web/app/content-site-data.spec.ts`
- `npm run web:build`
- local route checks for at least one diary detail page

## Success Criteria

- diary detail pages feel like real content pages
- the tone matches the rest of the site
- a user can read one entry and naturally continue to another
- the data structure is richer without becoming CMS-heavy
