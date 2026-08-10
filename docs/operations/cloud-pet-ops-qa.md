# Cloud-pet operations metrics QA

1. Unit-test token resolution: development fallback, production missing token,
   short/default token rejection, and strong token acceptance.
2. Unit-test five-minute buckets for 2xx, 4xx, 413, 429, and 5xx responses,
   expiry, and process start time.
3. Unit-test health projection for readiness, diary coverage, pending reports,
   and the 20-request/5-percent 5xx critical threshold.
4. API E2E-test missing, invalid, and valid `X-Ops-Metrics-Token` requests,
   stable 401 JSON, `no-store`, and privacy-safe response content.
5. Production smoke-test token authorization, snapshot shape, and the CLI
   healthy exit code while preserving existing migration, security, body-limit,
   session, and restart checks.
