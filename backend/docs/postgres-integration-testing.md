# PostgreSQL integration tests

The PostgreSQL suite uses a disposable local database. The compose service binds only to
`127.0.0.1`, uses an in-memory data directory, and discards its data when the container stops.
The guarded migration command accepts only `mteam_test` on port `55432`; it applies the checked-in
SQL files through `psql` inside this container and records each migration checksum. Re-running it
skips unchanged migrations and rejects checksum mismatches.

From the `backend` directory in PowerShell:

```powershell
if (-not (Test-Path .env.test.local)) { Copy-Item .env.test.example .env.test.local }
docker compose -f docker-compose.test.yml up -d --wait
$env:APP_ENV = 'test'
npm.cmd run prisma:migrate:test
npm.cmd test
npm.cmd run test:integration:notifications
```

The integration Jest config reads only `.env.test.local`; it never loads the application `.env`.
Set `APP_ENV=test` explicitly before migration. The checked-in example points to the local
container and contains test-only credentials. Do not replace it with staging or production
connection strings.

Stop and discard the database after the run:

```powershell
docker compose -f docker-compose.test.yml down
```

The suite exercises real PostgreSQL persistence, notification ownership/read status, class schedule
operations, and notification triggers. The full medical-upload E2E additionally needs a separate
Supabase test project with a private storage bucket and test-only service credentials; a local
PostgreSQL instance does not verify those Supabase Storage policies.
