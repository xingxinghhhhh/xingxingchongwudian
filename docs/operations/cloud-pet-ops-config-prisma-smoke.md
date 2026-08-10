# Cloud-pet operations config Prisma smoke

Run the production-style persistence check for merchant-managed cloud-pet rules with:

```text
npm run smoke:cloud-pet-ops-config-prisma
```

The command creates a fresh temporary SQLite database, deploys the existing Prisma migrations, and starts the compiled API with production configuration. It uses the real owner staff login/session and the real member verification/session flow.

The smoke updates the existing `daily-care` growth-task points and the active daily care score bonus through the existing Admin API. It then verifies the values through Admin reads and read-only Prisma queries, completes daily care through the member API, and proves that the configured points and care-score bonus are actually consumed by the user-facing business response.

The API is restarted with the same database. The original owner and member sessions must remain valid, both configuration values must be restored, and a second fresh pet must consume the same updated rules. A final read-only Prisma check verifies one `daily-care` template and one active care-score configuration with the updated values.

Success and failure output is machine-readable and does not print staff credentials, staff/member sessions, phone numbers, pet identifiers, or pet content. The temporary database and child processes are cleaned up by default. Set `KEEP_CLOUD_PET_OPS_CONFIG_PRISMA_SMOKE=1` only for local debugging. The command never uses `prisma/dev.db`, changes no schema or migration, and does not alter the existing production smoke or repository runtime artifacts.
