# Cloud Pet Product Plan

## Positioning

Cloud Pet is now treated as its own retention product line, separate from the pet commerce system. Commerce can still appear as a downstream bridge, but the primary goal is daily care, diary retention, pet homepages, and community interaction.

## Current State

- Cloud pet creation, pet profile loading, homepage editing, homepage archive, visit tracking, growth tasks, daily diary generation, community posting, likes, comments, follows, reports, and admin diary coverage recovery are already implemented.
- Backend coverage is stronger than the frontend experience.
- The current frontend has enough API wiring to validate the loop, but it needs to become a coherent user-facing cloud pet workspace before it is launch-ready.

## Gaps Before Launch

- Member ownership needs to feel natural: logged-in users should land on their own pets, not rely mainly on local storage or raw phone entry.
- The cloud pet creation flow still feels like a form instead of a first-time pet onboarding.
- Daily care needs to become the main loop with clear today status, task completion, care score feedback, and streak-like retention.
- Diary needs to become a core user asset with today entry, calendar/archive, editable notes, and sharing.
- Pet homepages need a stronger public/private split: public share page for visitors, owner workspace for editing and care.
- Community needs real comment input, visible comment threads, follow-driven feed, report reasons, and notification feedback.
- Member center and cloud pets need clearer responsibilities: `/cloud-pets` is the daily care workspace; `/member` is account, points, and notification summary.
- Admin operations need more cloud-pet-specific filters, single-pet detail, task template configuration, care-score rule configuration, and retention metrics.
- Production hardening needs member ownership checks, rate limits, input validation, database-first validation, logging, and browser smoke tests.
- Production browser smoke now verifies the real Owner page's matched Web/API release evidence and effective cloud-pet launch status before and after reload.

## Development Phases

### Phase 1: Cloud Pet Workspace

- Turn `/cloud-pets` into "My Cloud Pet Workspace".
- Read the existing member session.
- Load the current member profile and owned pets.
- Show pet switcher, active pet summary, growth tasks, recent timeline, homepage builder, and community posting from one place.
- If no pet exists, guide the user into pet creation.

### Phase 2: Daily Care Loop

- Add care actions such as feed, play, clean, and accompany.
- Show today's task state, care score explanation, and next action.
- Refresh pet state and diary after completion.
- Prevent duplicate completion while keeping the next-day loop clear.

### Phase 3: Diary Productization

- Add a diary-centered view for each pet.
- Show today diary, archive/calendar, diary filters, sharing, and manual owner notes.
- Make diary absence a clear prompt to care for the pet.

### Phase 4: Launch-Ready Pet Homepage

- Improve `/cloud-pets/[petNo]` as a shareable public pet homepage.
- Separate owner editing controls from visitor-facing content.
- Show avatar, level, care state, recent diary, recent community posts, archive, and visit stats.

### Phase 5: Community Interaction

- Add a stronger feed, visible comments, comment input, follow-based activity, report reasons, and notification hooks.

### Phase 6: Admin Cloud Pet Operations

- Add pet search/filter, single-pet detail, retention metrics, task templates, care-score rules, diary operations, and enhanced moderation.

### Phase 7: Launch Hardening

- Add ownership checks, rate limits, input limits, database-first validation, logs, mobile checks, and smoke tests.

## Current Priority

Phases 1 through 6 now have their primary user and operator loops in place. The current priority is Phase 7 launch hardening: abuse protection, production configuration validation, database-first verification, observability, and deployment smoke coverage. Commerce remains a downstream bridge rather than the active development line.

## Latest Progress

- Phase 1 session recovery now distinguishes invalid authentication from temporary member-profile failures: invalid sessions are cleared with localized guidance, while transient failures preserve the session and active pet for an in-place retry.
- Phase 5/6 moderation now supports a single owner action to resolve a report and hide its related post, preserves explicit partial-failure feedback, and renders completed reports read-only with notes and resolution time.
- Phase 4 public homepage hardening now returns a localized HTTP 404 for missing pets without recording a visit, normalizes unsupported archive filters, and degrades optional archive, recommendation, or community failures without hiding the pet profile.
- Admin operator Playwright coverage now proves retention and task data remain visible while owner-only growth-task and care-score controls stay read-only without `cloud_pets:write`.
- Phase 6 single-pet operations now have an owner-authenticated Playwright path covering pet-number/species filtering and detail inspection across care, diary, community, homepage visits, and risk signals.
- Phase 6 diary operations now have an owner-authenticated Playwright path from a seeded missing diary through selected backfill, success details, and refreshed gap removal.
- Phase 1 multi-pet workspace hardening now resets pet-scoped diary and task state on switch, restores the last active pet, and prevents stale recommendation responses from replacing the current pet.
- The workspace now keeps the member login hidden during session restoration and exposes explicit recommendation loading, empty, error, and retry states.
- Playwright now covers two-pet state isolation, rapid-switch response races, active-pet refresh persistence, and recommendation failure recovery.
- Phase 7 proxy-aware abuse protection now requires an explicit production `TRUST_PROXY_HOPS`, configures Express before throttling, and proves in production smoke that separate forwarded clients receive independent verification-code allowances.
- Admin operations now surface the rolling 24-hour member-verification funnel: issued, successful, active, expired, locked, failed attempts, and success rate.
- Phase 7 member identity now requires a one-time phone verification challenge before session creation; codes are HMAC-hashed, expire after five minutes, allow at most five attempts, and are consumed exactly once.
- Production member verification now uses a required HTTPS webhook adapter and never returns the code; production smoke exercises the provider call, challenge consumption, session restart continuity, and logout revocation.
- The member center and cloud-pet workspace now expose the same request-code/login flow, while pet creation and checkout no longer create a member session silently from a phone number.
- Phase 7 public/private profile separation now removes member names and phone numbers from the public cloud-pet API, generates a public-safe pet bio, and clears all private workspace state immediately on member logout.
- Cloud-pet Playwright coverage now proves public pages do not display member identity and logged-out browsers cannot restore the private daily-care workspace from a saved pet number.
- Phase 7 public homepage metrics now use a browser-scoped anonymous visitor ID, store only its hash, and count each pet/source/visitor once per day in both memory and database modes.
- Production smoke now verifies homepage visit deduplication, Prisma uniqueness, and visit-count persistence across an API restart.
- Phase 7 abuse protection now limits cloud-pet creation to five pets per member session per hour and centralizes the shared throttler configuration used by cloud pets and community writes.
- Phase 7 cloud-pet creation now requires an active member session and always binds ownership from the server-side session; anonymous creation returns 401.
- The cloud-pet workspace now revokes the server session on member switch and no longer recreates authentication from saved name/phone after logout.
- Phase 7 member ownership hardening now uses random expiring member sessions persisted in production, supports logout revocation and restart continuity, and removes the anonymous phone lookup path from the member center.
- Member profile, address, and point-redemption APIs now require the active member session; legacy phone routes remain compatibility-only and reject anonymous or cross-member access.
- Phase 7 admin identity hardening now persists production staff and revocable sessions, uses salted scrypt password hashes, enforces session expiry and disabled-staff checks, and proves session continuity and logout revocation across a production restart.
- Phase 7 database verification now fails production smoke on Prisma migration drift; the missing Payment Intent and Payment Ledger database structures are covered by a backward-compatible alignment migration.
- Phase 7 production smoke now builds from a clean `dist`, applies all migrations to an isolated SQLite database, starts the API and Next production artifacts, checks readiness, cloud-pet/admin routes and owner login, and proves cloud-pet operations configuration survives a process restart.
- Production builds now use `src` as the explicit TypeScript root and remove stale `dist` output before compilation, preventing deployment of an obsolete `dist/main.js`.
- Phase 7 observability now propagates safe request IDs, exposes them to browser clients, emits privacy-conscious structured production access logs, and records 5xx requests at error level.
- Phase 7 HTTP security now applies Helmet response headers, removes framework fingerprinting, keeps the cross-origin API resource policy explicit, enables graceful Nest shutdown hooks, and verifies trusted/untrusted CORS behavior in production smoke.
- Phase 7 dependency hardening now runs on patched Next/Nest transitive dependencies and a verified Sharp security override, with the official production dependency audit reporting zero vulnerabilities.
- Phase 7 deployment health now separates liveness from readiness, reports the actual SQLite provider, and returns 503 when the configured database cannot answer a readiness query.
- Phase 7 database-first hardening now persists admin growth-task templates and care-score rules, restores them on application startup, and includes a verified production migration command.
- Phase 7 production startup validation now blocks missing database configuration, memory-store mode, default or weak admin keys, local CORS origins, invalid payment timeouts, and missing production owner credentials.
- Production admin authentication now loads only the configured owner account, disables hard-coded development owner/operator tokens, and removes development credentials from the production login screen.
- Phase 7 community write protection now rate limits posts, likes, comments, follows, and reports per member session, returns a Chinese 429 response, and preserves independent allowances for members sharing one network.
- Admin staff session gates now have Playwright coverage for unauthenticated redirect, owner login, sign out, and post-logout protection on cloud-pet admin pages.
- Phase 6 admin community report filters now have Playwright page coverage from seeded reports through owner login and filtered queue results.
- Phase 6 admin community report queue now supports status, post, and member filters for faster moderation triage.
- Phase 6 admin community report queue now surfaces reporter identity, submitted reason, and created time for faster moderation triage.
- Phase 5 workspace report feedback now distinguishes newly queued reports from existing pending reports, with Playwright coverage for both states.
- Phase 5 community report responses now expose whether a report was newly created, letting the workspace avoid pulse inflation even after reloads.
- Phase 5 workspace reports now submit the selected report reason, with Playwright asserting the outgoing report request body.
- Phase 5 workspace reports now avoid local pulse inflation on repeated report clicks, with Playwright coverage for stable report and signal totals.
- Phase 5 community reports now reuse an existing pending report from the same member and post, preventing duplicate moderation queue inflation.
- Phase 5 backend e2e now proves repeated community likes and follows remain idempotent at one like/follower for the same member.
- Phase 5 community follows now update workspace follower metrics from provider counts and Playwright verifies repeated follows do not inflate member pulse totals.
- Phase 5 community likes now update workspace metrics from provider counts and Playwright verifies repeated likes do not inflate member pulse totals.
- Phase 5 Playwright coverage now clicks community likes in the workspace and verifies post metrics, member pulse, and public homepage interaction totals refresh.
- Launch hardening now has e2e coverage proving anonymous users cannot like, comment, follow, or report community content without a member session.
- Launch hardening now trims member login names at DTO validation time before name length checks while preserving blank-name business errors.
- Launch hardening now trims owner diary note titles and bodies at DTO validation time before length checks while preserving blank-body business errors.
- Launch hardening now trims owner diary note titles and bodies at DTO validation time before length checks.
- Launch hardening now trims community post bodies, comments, and report reasons at DTO validation time before length checks.
- Launch hardening now trims cloud-pet homepage headline and owner story at DTO validation time before length checks.
- Launch hardening now trims cloud-pet creation text fields at DTO validation time before length checks.
- Launch hardening now trims public homepage visit sources at DTO validation time before source format checks.
- Launch hardening now trims member and cloud-pet creation phone numbers at DTO validation time before phone format checks.
- Admin cloud-pet API client coverage now verifies blank search keywords are omitted from operation filters.
- Launch hardening now covers owner diary note API blank rejection and trim persistence for create and edit flows.
- Launch hardening now trims member login names at the API boundary and rejects blank member names before creating sessions.
- Launch hardening now mirrors backend member phone format validation in the cloud-pet member sync and pet creation inputs.
- Launch hardening now trims member sync identity input and disables blank member sync in the cloud-pet workspace while mirroring backend name and phone limits.
- Launch hardening now mirrors the 280-character community comment limit in the workspace comment input.
- Launch hardening now mirrors cloud-pet creation field length limits in the workspace inputs for owner name, phone, pet name, and personality.
- Launch hardening now disables blank owner diary note create and edit actions in the workspace, matching the existing API trim/blank guard.
- Launch hardening now trims cloud-pet creation owner name, pet name, and personality while rejecting blank creation fields in API and workspace onboarding.
- Launch hardening now trims homepage headline and owner story updates while rejecting blank homepage copy in API and workspace saves.
- Launch hardening now trims community comments and report reasons, rejecting blank submissions at the API and disabling blank comment sends in the workspace.
- Launch hardening now trims community post bodies and rejects blank posts across API and workspace submission.
- Launch hardening now exposes and tests the 280-character community post limit in the workspace while preserving backend rejection of oversized posts.
- Phase 5 public pet homepage community posts now preview recent visible comments so visitors can see conversation context.
- Phase 3 public pet homepage now shows active diary days with links into the full public archive.
- Phase 3 diary calendar days can now focus the workspace archive on a specific active date and clear the date filter.
- Phase 3 diary archive now includes a lightweight calendar summary of recent active diary days in the workspace.
- Phase 5 public community posts now show their posted date inside the pet homepage panel.
- Phase 5 public community panel now surfaces the latest public update date for homepage freshness.
- Phase 5 public community panel now summarizes public interactions across visible community posts.
- Phase 5 public community panel now shows a visible count of public updates on the pet homepage.
- Phase 5 public homepage Share Card now links directly to the community updates panel.
- Phase 5 workspace community posts now let owners copy a direct discussion link for each post.
- Phase 5 workspace community posts now highlight their target state when opened from a public homepage discussion link.
- Phase 5 public community posts now deep-link to their matching workspace discussion anchors.
- Phase 5 public homepage community panel now links visitors back to the workspace community conversation area.
- Phase 4 public homepage Recent Diary items now link directly to their archive anchors.
- Phase 4 public homepage Today panel now links today's generated diary directly to its archive anchor.
- Phase 4 public homepage Share Card now gives visitors a direct CTA into the full diary archive.
- Phase 4 homepage sharing now lets owners copy the public pet homepage link directly from the workspace card.
- Phase 3 public diary shares now have visible entry permalinks and target highlighting on the pet homepage archive.
- Phase 3 diary sharing now lets owners copy a precise public link for each generated diary or owner note from the workspace.
- Phase 3 diary public archive links now point to stable per-entry anchors on the shareable pet homepage.
- Phase 3 diary asset flow now gives each workspace diary entry a direct public archive link for generated diaries and owner notes.
- Phase 5 community reminder flow now switches from post prompt to view-post prompt after today's community update is published from the prefilled diary draft.
- Phase 5 community conversion now pre-fills the community post draft from today's generated diary when the post-care reminder is clicked.
- Phase 2 revisit reminders now shift after daily care completion into homepage sharing and community-post prompts, with Playwright coverage on the first-pet loop.
- Phase 2 retention loop now shows cloud-pet workspace revisit reminders for unfinished daily care, missing daily diary, and recent member notifications, with Playwright coverage on the first-pet path.
- Phase 6 admin cloud-pet list now supports risk-first sorting, ordering pets by highest risk level and risk signal count after filters are applied.
- Phase 6 admin cloud-pet list now supports local risk-level filtering so operators can focus on high, medium, or low risk pets after server-side pet filters run.
- Phase 6 admin cloud-pet list now shows list-level risk counts and highest-risk badges so operators can triage pets before opening detail.
- Phase 6 admin risk signals now include action links to diary coverage gaps, report review, community moderation, pet operations, and public homepage inspection.
- Phase 6 admin single-pet detail now surfaces operational risk signals for incomplete care, missing diary, pending reports, low homepage traffic, and missing community posts.
- Phase 6 admin single-pet detail now shows recent diary snippets and recent community posts so operators can inspect the content behind the metrics.
- Phase 6 admin cloud-pet operations now include per-pet community signal totals in the operational detail view: posts, likes, comments, reports, and pending reports.
- Phase 5 community feedback now surfaces a member-level Community pulse in the cloud-pet workspace, with likes/comments/follows/reports updating during the daily-care flow.
- Phase 5 community interaction now has a clearer comment thread state: empty comments are visible, new comments update the card metrics, and the daily-care Playwright path verifies it.
- Phase 4 public homepage sharing now exposes a testable Share Card with share URL, visit count, and a visitor CTA to create their own cloud pet.
- The day-one Playwright smoke now follows the post-care next action into the public pet homepage, proving the workspace-to-shareable-homepage path.
- The first-pet Playwright smoke now covers the full day-one path: empty workspace, pet creation, missing diary guidance, daily-care completion, and generated diary confirmation.
- Phase 3 diary guidance now links a missing today diary directly to the Daily Care task area, with UI coverage from first-pet onboarding through the care CTA.
- Phase 1 onboarding now gives synced members without pets a first-pet creation CTA that jumps to the creation form, with Playwright coverage for the empty-to-created path.
- The cloud-pet workspace now sends the member session on pet creation so the backend ownership calibration is active in the normal user flow.
- Launch hardening now requires `X-Member-Token` for cloud-pet creation and calibrates ownership from the active member session.
- Phase 1 creation ownership is now locked to the active member profile once synced, preventing logged-in users from creating cloud pets under a different owner identity.
- Phase 1 ownership flow now restores the cloud-pet workspace only from a live member session; saved identity may prefill the form but cannot silently recreate authentication.
- Member-protected workspace actions now share runtime session-expiry handling, immediately clearing private pet state and local credentials when a previously valid session is revoked.
- Phase 7 mobile launch hardening now includes a targeted Playwright mobile smoke for member sync, pet creation, workspace panels, and public homepage navigation.
- Phase 1 workspace is now covered by a Playwright smoke path for member sync, pet creation, daily care, homepage editing, community posting, commenting, and public page verification.
- Phase 2 daily care now exposes today completed task keys, care completion state, care streak days, last care date, and next care prompt.
- Phase 2 daily care now includes feed, play, clean, and quiet-company care actions while keeping generated daily diaries idempotent.
- Phase 3 diary productization has started with owner diary notes saved through a member-owned API and surfaced in the workspace archive and public pet homepage.
- The cloud pet workspace now shows whether today's generated diary is present and guides the owner to complete daily care when it is missing.
- The workspace diary archive now supports all/generated/owner-note filters with counts, and the UI smoke path covers the filter flow.
- Owner diary notes can now be edited and deleted by the owning member while generated daily diaries remain system-managed.
- Phase 4 public homepage now shows live care streak and next care prompt signals from the pet growth profile.
- Phase 4 public homepage now shows today care status, today generated diary status, and UI-covered archive filters for generated diaries and owner notes.
- Admin cloud-pet operations now support keyword, species, and care-state filtering for merchant operations.
- Community comments can now be listed through the API and rendered in the cloud pet workspace.
- Community follow actions now give immediate workspace feedback with follower count and are covered in the UI smoke path.
- Community following now drives a member-authenticated following feed, with workspace filters for all, followed pets, and the active pet.
- Community following feeds now refresh from the active member session, discard stale asynchronous responses, and clear personalized posts when the member logs out or workspace synchronization fails.
- Community follow responses now distinguish newly created follows from idempotent repeats, preventing workspace engagement totals from increasing again after a page refresh.
- Community feed refreshes now expose loading, recoverable error, and retry states while preserving the last successfully loaded posts during temporary failures.
- Community reporting now includes selectable front-stage reasons before creating admin report queue entries.
- Admin cloud-pet operations now include a single-pet operational detail view with archive, diary, homepage visits, community posts, and pending report signals.
- Admin cloud-pet operations now expose retention metrics for care completion, care-state mix, average care score, best streak, diary coverage, visits, posts, and pending reports.
- Admin cloud-pet operations now show today's growth task completion distribution for task-operation review.
- Admin cloud-pet operations now expose owner-protected care score rules for daily task bonus and care-state thresholds.
- Admin cloud-pet operations now allow owner-protected growth task template tuning for points and rewards, with operation logs and permission checks.
- Admin cloud-pet operations now let moderators remove public owner diary notes from pet homepages, with staff operation logs.
- Launch hardening now limits owner diary notes to 5 per pet per day, with API enforcement, workspace input hints, and e2e coverage.
- Launch hardening now validates homepage visit sources and aggregates same-day same-source memory visits while preserving total visit metrics.
- Launch hardening now bounds community comment and report reason lengths, with e2e coverage for oversized input rejection.
- Phase 7 public homepage release checks now include deterministic Playwright visual baselines for the valid `/cloud-pets/:petNo` profile at desktop and 390x844 mobile sizes. Dynamic pet numbers, share URLs, and visit counts are masked so the snapshots protect layout without becoming data-dependent.
- Phase 7 SQLite recovery now creates consistent backups through Prisma `VACUUM INTO`, publishes privacy-safe SHA-256 manifests, and proves migration plus cloud-pet domain integrity through repeatable isolated restore drills.
- Phase 7 Owner operations now exposes a privacy-safe SQLite recovery status projection backed by manifest-matched restore-drill attestations, without adding backup or restore actions to the Admin UI.
- Phase 7 HTTP request boundaries now explicitly limit JSON and URL-encoded request bodies through `API_BODY_LIMIT_BYTES` (default 100 KiB, validated between 16 KiB and 1 MiB), return a stable Chinese `413 PAYLOAD_TOO_LARGE` contract, and verify that an oversized request does not take the API out of readiness.
- Phase 7 operations hardening now exposes an independently token-protected cloud-pet health snapshot with five-minute process HTTP metrics, readiness, daily diary coverage, pending community reports, and a CLI check for actionable launch operations.
- Phase 7 cloud-pet persistence checks now exercise the core daily-care, care-score/streak, automatic-diary, member-session, restart, idempotency, and final Prisma consistency path on a fresh production-style SQLite database.
- Phase 7 cloud-pet operations checks now prove owner-updated growth-task and care-score rules persist in Prisma, survive an API restart, and are consumed by subsequent member daily-care actions on a fresh production-style SQLite database.
- Phase 7 production browser checks now prove real webhook member login, mobile cloud-pet workspace creation, and hard-reload recovery against a production Next + Nest/Prisma runtime.
- Phase 7 production browser checks now also prove one real daily-care action, visible care feedback, automatic diary visibility, UI idempotency, and reload recovery.
- Phase 7 production browser checks now also prove an authenticated pet can be opened from a fresh anonymous browser context through its public homepage without exposing owner identity fields.
- Phase 7 production browser checks now also prove a member-created owner note remains visible after a production workspace reload and has exactly one persisted event alongside the automatic diary.
- Phase 7 production browser checks now also prove an owner Admin session can find the same member-created pet by pet number, inspect its care score and owner note, and recover the detail after an Admin reload.
- Phase 7 production browser checks now also prove an owner can find a second pet's daily-diary gap, select only that pet for backfill, and have the member see the recovered diary after reload without a fabricated task completion or care-score reward.
- Phase 7 production browser checks now also prove a real community post can be reported by a member, processed and hidden by an owner in Admin, and remain absent from the normal member feed after reload, with Prisma confirming the reviewed report and hidden post states.
- Phase 7 production browser checks now also prove the two real moderation operation logs remain visible after an Admin reload, with staff identity, role, action, and target cross-checked against Prisma without exposing sensitive metadata.
- Phase 7 operations hardening now also exposes the existing health snapshot through an Owner-session Admin projection, so merchants can view process-level five-minute HTTP errors/rate limits, diary coverage, pending reports, and the latest status without receiving the internal metrics token.
- Phase 7 deployment hardening now exposes a startup-only Prisma migration compatibility snapshot through Owner deployment readiness, blocks production launch readiness when the existing read-only migration diff is mismatched or unavailable, and shows the safe status in the Admin deployment card without allowing online migration execution.
- Phase 7 production startup now applies a fail-closed Prisma migration gate before listening: compatible snapshots proceed, mismatch/unavailable snapshots close the app without accepting traffic, and non-production startup remains unchanged.
- Phase 7 production startup now also fail-closes an unconfigured safe configuration baseline with a dedicated startup error before reading migration status; non-production startup remains unchanged.
- Phase 7 production startup now also requires an existing validated release ID before listening, with a dedicated missing-release startup error; the existing deployment/launch readiness contract remains unchanged.
- Phase 7 production startup now also verifies a fixed build-time release marker matches the validated runtime release ID before migration compatibility; missing, invalid, or mismatched markers fail closed without changing deployment APIs or release format.
- Phase 7 production startup now also fail-closes only on an explicitly mismatched safe configuration baseline; an unconfigured baseline remains allowed with the existing launch blocker, while matched production configuration proceeds through the migration gate.
- Phase 7 diary semantics now preserve legacy `daily_diary` records neutrally while new task-generated and backfill-generated diaries use `care_daily_diary` and `presence_daily_diary`; coverage still treats all three as diary presence, and the member workspace explains that a presence diary is not task completion.
- Phase 7 ownership evidence now covers two real member sessions with isolated pet profiles, a rejected cross-member owner-note write, a successful owner write, and cross-member public homepage Visitor versus Owner views after reload.
