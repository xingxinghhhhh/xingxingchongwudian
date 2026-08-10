# Cloud Pet Production Browser Smoke

`smoke:cloud-pet-web-production` creates a temporary SQLite database, applies the current Prisma migrations, builds the production Next application, and starts the production Nest API and Next server.

The smoke receives the member verification code through a local test webhook. It uses a 390x844 browser viewport and verifies this member-facing path:

```text
real verification-code login
  -> create the first cloud pet
  -> persist the member session and active pet
  -> hard reload and restore the workspace
  -> complete one daily-care task through the real UI
  -> observe the completed count and care score update
  -> observe the care state and automatic diary
  -> hard reload and verify those states remain persisted
  -> verify the completed task is no longer actionable
  -> add one owner note through the real member workspace UI
  -> hard reload and verify the owner note and automatic diary remain visible
  -> publish one uniquely marked community post through the member UI
  -> report that post through the member UI
  -> open the pet homepage in a new anonymous browser context
  -> verify public content is visible without private owner fields
  -> open a separate owner Admin browser context
  -> filter the same pet by pet number and inspect its operational detail
  -> reload Admin and verify the same pet, care score, and owner note remain readable
  -> filter the community report by post number
  -> process and hide the reported post through the Admin UI
  -> reload Admin and inspect the recent operation logs
  -> verify both moderation actions retain the real owner staff, role, action, and target
  -> create a second pet without completing today's care task
  -> find that pet in the Admin daily-diary coverage gaps
  -> select only that pet and run the real Admin diary backfill
  -> verify the gap disappears from Admin
  -> reload the member workspace and observe the backfilled diary
  -> verify task completion, care score, and care action were not fabricated
  -> verify the moderated community post is absent from the normal member feed
  -> click the real member logout action
  -> clear the private workspace and active-pet browser state
  -> hard reload without restoring the private session
  -> reject the private member profile API in the same browser context
```

The daily-care action, community post/report, and second-pet creation use the existing UI controls. The smoke does not call the care, report, moderation, or diary backfill APIs directly, write task completions, diary events, posts, or reports with Prisma, or reproduce the care-score algorithm. It verifies stable user-visible state plus a minimal final Prisma check for ownership, a hidden moderated post, a reviewed report, both moderation operation logs, exactly one backfilled diary, and zero task completions for the recovered pet. Audit assertions use the safe operation-log projection only; they do not expose metadata or request bodies.

Run it with:

```text
npm run smoke:cloud-pet-web-production
```

The command builds the API first and the smoke script builds the production web artifact with its temporary API origin. All child processes, the webhook, and the temporary database directory are cleaned up after the run unless `KEEP_CLOUD_PET_WEB_PRODUCTION_SMOKE=1` is set.

The logout assertion is intentionally the final member action. It verifies the user-visible exit path, the browser reload boundary, the private API response, and the final revoked MemberSession state without printing tokens or member personal data.

The smoke is a release-candidate business browser check, not a replacement for the normal `test:ui` suite or a high-frequency health check. It intentionally avoids printing member phone numbers, verification codes, session tokens, pet numbers, or diary body text.
