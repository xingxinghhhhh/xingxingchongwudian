# Cloud-pet operations monitoring

The API exposes a small authenticated health snapshot for launch operations:

```text
GET /api/internal/ops/cloud-pet-health
X-Ops-Metrics-Token: <configured token>
```

Owner staff can view the same health data from the authenticated Admin
surface without receiving the internal token:

```text
GET /api/admin/ops/cloud-pet-health
X-Admin-Session: <owner session>
```

This Admin route is owner-only through the existing `audit:read` permission,
returns a safe projection for the dashboard, and keeps the internal token and
infrastructure details out of the browser. Operators receive the existing
`403` permission response, while an absent or invalid staff session receives
`401`.

`OPS_METRICS_TOKEN` is required in production and is intentionally separate from
member and admin sessions. The endpoint returns `Cache-Control: no-store` and
never includes request bodies, member identity, or the token.

HTTP metrics are process-local rolling counters for the latest five minutes.
They use minute buckets, reset on process restart, and observe final response
status codes through a fail-open middleware. The snapshot includes request,
4xx, 5xx, and 429 counts plus the 5xx rate.

The snapshot is `critical` when database readiness fails or when at least 20
requests have occurred and the 5xx rate is at least 5 percent. Daily diary
coverage, pending community reports, and 429 counts are reported for operator
visibility but are not critical thresholds in this first version.

The Admin dashboard exposes the current status, process-local five-minute
request/5xx/429 counters, daily diary coverage, pending community reports, and
the snapshot timestamp. It refreshes only when the Owner clicks the refresh
button; there is no browser polling.

When the diary coverage reports missing pets, the Owner health card links to
the existing daily-diary coverage page with the same server-provided business
date. The link only opens the existing missing-diary workflow; it does not
start a backfill automatically.

When pending community reports exist, the same Owner card links to the
existing report queue with its current `pending_review` filter initialized.
The link only opens the moderation area; it does not resolve or hide a report.

Run the local/production check with:

```text
npm run ops:check:cloud-pet
```

The checker reads `OPS_BASE_URL` and `OPS_METRICS_TOKEN`. Exit codes are 0 for
healthy, 20 for an unreachable endpoint, 21 for unauthorized, 22 for readiness
failure, 23 for a high 5xx rate, and 24 for an invalid response. No scheduler,
database table, frontend page, external monitoring provider, or multi-instance
aggregation is introduced by this node.
