# Dual Pet Content Site Design

**Project:** First-stage content website for a cloud-pet brand

**Goal**

Build a warm, premium content site centered on two main pets: one cat and one dog. The site should feel like a story-led Apple-style launch page on the homepage, then transition into profile and journal content that makes visitors want to return for updates.

**Scope for this stage**

- Public-facing homepage only
- Two main characters with distinct personalities
- Pet profile content
- Growth diary / journal timeline
- Daily fragments / small moments
- Favorite things / habits / toys as content only
- A visible roadmap section for future paid cloud-pet and community features

**Out of scope for this stage**

- Ecommerce checkout
- User accounts
- Paid memberships
- Pet community posting
- Admin publishing tools

## Product Direction

This is not a store homepage right now. It is a content IP website with room to grow into:

1. a continuing pet journal,
2. paid custom cloud-pet experiences,
3. a user pet community,
4. later commerce around toys and accessories.

The first release should optimize for emotional attachment, memorability, and repeat visits.

## Recommended Approach

Use a hybrid structure:

1. **Story-led hero**
   A cinematic first screen that introduces the cat and dog as the heart of the brand.
2. **Profile-led middle**
   Clear profile cards and personality details so visitors quickly understand each pet.
3. **Diary-led lower sections**
   A feed of recent moments and milestone entries to create the habit of returning.

This balances brand feel, clarity, and future extensibility better than a pure blog or pure profile site.

## Information Architecture

### Homepage

1. Sticky top navigation
   - Brand
   - Stories
   - Profiles
   - Diary
   - Future Plans

2. Hero section
   - Large headline
   - Short emotional supporting copy
   - Two CTAs: jump to diary, jump to profiles
   - Editorial visual cards that hint at the cat and dog personalities

3. Character intro section
   - Two featured profile cards
   - One cat, one dog
   - Each card shows role, age, energy, favorite activity, and temperament

4. Story chapter section
   - Three short thematic chapters
   - For example: meeting them, living together, collecting small daily moments

5. Recent diary section
   - Mixed timeline with entries from both pets
   - Short title, date, emotional tone, and a few tags

6. Favorite things section
   - Not a shop yet
   - Show beloved toys, blankets, corners, rituals, and routines

7. Future roadmap section
   - Paid custom cloud-pet
   - Private pet archive
   - Community interaction
   - Same-style toy recommendations later

## Data Model for the Frontend

For now, keep the content local to the frontend in typed static data:

- `pets`
  - `id`
  - `name`
  - `type`
  - `role`
  - `ageLabel`
  - `breedLabel`
  - `temperament`
  - `favoriteThing`
  - `signatureColor`
  - `heroImage`

- `journalEntries`
  - `id`
  - `petId`
  - `title`
  - `dateLabel`
  - `mood`
  - `summary`
  - `tags`

- `storyChapters`
  - `id`
  - `title`
  - `summary`

- `favoriteMoments`
  - `id`
  - `label`
  - `detail`

This keeps the homepage easy to render now while matching a later CMS or database shape.

## Visual Direction

- Warm Apple-like editorial design
- Large type, strong spacing rhythm, quiet premium surfaces
- Soft neutral background with restrained warm accents
- Rounded but not playful-toy-like cards
- Use photography-rich sections and polished text hierarchy

The page should feel intimate and premium, not cute-for-its-own-sake and not ecommerce-heavy.

## Error Handling

- If API-backed content is not ready, the homepage still renders entirely from static content
- Avoid critical client-side data dependencies for the first release
- Keep the page resilient for deployment demos and sharing links

## Testing

- Add a small unit test for the new content data utilities
- Verify the homepage builds successfully with `npm run web:build`
- Verify the page visually in the local browser at `http://localhost:3001`

## Success Criteria

- The homepage clearly communicates a dual-pet world, not a storefront
- Visitors can quickly understand who the cat and dog are
- The diary content feels like an ongoing series rather than a one-off landing page
- The structure obviously supports future cloud-pet and community features
