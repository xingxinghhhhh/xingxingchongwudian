# Cloud-pet Prisma persistence smoke

Run the production-style cloud-pet business persistence check with:

```text
npm run smoke:cloud-pet-prisma
```

The command builds the API, creates a fresh temporary SQLite file, deploys the
existing Prisma migrations, and starts the compiled API with production
configuration. It then uses the real member verification webhook/session flow
and real HTTP routes to create one cloud pet, complete `daily-care`, verify
care state and one `daily_diary`, restart the API, read the same state with the
same member session, replay the completed task, and verify idempotency.

After the API is stopped, the smoke performs read-only Prisma checks for one
task completion and one automatic diary on the business date. It prints only
the machine-readable success/failure code and never prints phone numbers,
verification codes, session tokens, pet identifiers, or diary content.

The database and child processes are cleaned up in both success and failure
paths. Set `KEEP_CLOUD_PET_PRISMA_SMOKE=1` only for local debugging. The smoke
never uses `prisma/dev.db` and does not modify the repository database, Prisma
schema, migrations, product rules, or frontend code.
