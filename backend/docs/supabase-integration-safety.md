# Safe execution of the Supabase integration suite

The Supabase integration suite writes application records and can leave fixtures behind
when a run is interrupted. It is not a read-only diagnostic and must not target production
or a shared database.

Before running it, verify in the Supabase dashboard that the project is an isolated test
project, confirm that a current backup exists, and set these ignored local environment
variables:

- SUPABASE_INTEGRATION_TARGET_KIND=isolated-staging or isolated-development
- SUPABASE_INTEGRATION_ALLOW_WRITES=YES
- SUPABASE_INTEGRATION_BACKUP_CONFIRMED=YES
- SUPABASE_INTEGRATION_PROJECT_REF to the verified project reference

The guard compares that reference with SUPABASE_URL, DATABASE_URL, and DIRECT_URL. It does
not inspect the project plan or prove that the database is isolated; that verification
remains an operator responsibility. Do not infer the target from APP_ENV.

The report in supabase-requirements-verification.md is dated September 25, 2026. Treat its
Supabase counts, migration status, and feature results as historical evidence until a new
authorized read-only inspection confirms them.
