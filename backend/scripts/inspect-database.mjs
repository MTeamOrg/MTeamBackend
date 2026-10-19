import { resolve } from "node:path";
import { resolve4, resolve6 } from "node:dns/promises";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { config } from "dotenv";
import pg from "pg";

const appEnvironment = process.env.APP_ENV ?? process.env.NODE_ENV ?? "development";
config({
  path: [
    resolve(process.cwd(), `.env.${appEnvironment}.local`),
    resolve(process.cwd(), ".env"),
  ],
  override: false,
  quiet: true,
});

const applicationTables = [
  "user",
  "member_profile",
  "trainer_profile",
  "membership_price",
  "payment",
  "medical_certificate",
  "branch",
  "access_point",
  "access_log",
  "weekly_schedule",
  "scheduled_class",
  "trainer_branch",
  "user_audit_log",
  "event",
  "news_post",
  "notification",
];

const connectionString = process.env.DIRECT_URL;
if (!connectionString) {
  console.error("DIRECT_URL is required");
  process.exit(1);
}

const client = new pg.Client({ connectionString });

function describeConnection(value) {
  if (!value) return { configured: false };
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return {
      configured: true,
      protocol: url.protocol,
      target:
        hostname.endsWith(".pooler.supabase.com")
          ? "supabase-pooler"
          : hostname.startsWith("db.") && hostname.endsWith(".supabase.co")
            ? "supabase-direct"
            : "other",
      port: url.port || "default",
      hasUsername: Boolean(url.username),
      hasPassword: Boolean(url.password),
      hasDatabaseName: url.pathname.length > 1,
      queryParameters: [...url.searchParams.keys()].sort(),
    };
  } catch {
    return { configured: true, validUrl: false };
  }
}

async function describeDns(value) {
  if (!value) return { configured: false };
  try {
    const hostname = new URL(value).hostname;
    const [ipv4, ipv6] = await Promise.all([
      resolve4(hostname).then(
        (addresses) => ({ status: "ok", records: addresses.length }),
        (error) => ({ status: "failed", code: error?.code ?? "unknown" }),
      ),
      resolve6(hostname).then(
        (addresses) => ({ status: "ok", records: addresses.length }),
        (error) => ({ status: "failed", code: error?.code ?? "unknown" }),
      ),
    ]);
    return { ipv4, ipv6 };
  } catch {
    return { validUrl: false };
  }
}

try {
  await client.connect();

  const tableResult = await client.query(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = $1
        AND table_type = $2
      ORDER BY table_name`,
    ["public", "BASE TABLE"],
  );
  const tables = tableResult.rows.map(({ table_name: tableName }) => tableName);

  console.log("connection=ok");
  console.log(`public_tables=${JSON.stringify(tables)}`);

  if (tables.includes("_prisma_migrations")) {
    const migrationResult = await client.query(
      `SELECT migration_name,
              checksum,
              finished_at IS NOT NULL AS finished,
              rolled_back_at IS NOT NULL AS rolled_back
         FROM public._prisma_migrations
        ORDER BY started_at`,
    );
    const migrations = [];
    for (const migration of migrationResult.rows) {
      const migrationPath = resolve(
        process.cwd(),
        "prisma",
        "migrations",
        migration.migration_name,
        "migration.sql",
      );
      const localSql = await readFile(migrationPath);
      const localChecksum = createHash("sha256").update(localSql).digest("hex");
      const normalizedSql = Buffer.from(
        localSql.toString("utf8").replaceAll("\r\n", "\n"),
        "utf8",
      );
      const normalizedChecksum = createHash("sha256")
        .update(normalizedSql)
        .digest("hex");
      migrations.push({
        migrationName: migration.migration_name,
        finished: migration.finished,
        rolledBack: migration.rolled_back,
        checksumMatches:
          localChecksum === migration.checksum ||
          normalizedChecksum === migration.checksum,
        lineEndingNormalized:
          localChecksum !== migration.checksum &&
          normalizedChecksum === migration.checksum,
      });
    }
    console.log(`migrations=${JSON.stringify(migrations)}`);
  } else {
    console.log("migrations=[]");
  }

  const rowCounts = {};
  for (const table of applicationTables) {
    if (!tables.includes(table)) continue;
    const safeTable = table.replaceAll('"', '""');
    const countResult = await client.query(
      `SELECT COUNT(*)::int AS count FROM public."${safeTable}"`,
    );
    rowCounts[table] = countResult.rows[0].count;
  }
  console.log(`app_row_counts=${JSON.stringify(rowCounts)}`);

  const verificationMarkerResult = await client.query(
    `SELECT
       (SELECT COUNT(*)::int FROM public."user"
         WHERE email LIKE 'mteam.verify.%@example.com') AS users,
       (SELECT COUNT(*)::int FROM public.member_profile AS profile
         JOIN public."user" AS app_user ON app_user.id = profile.user_id
        WHERE app_user.email LIKE 'mteam.verify.%@example.com') AS member_profiles,
       (SELECT COUNT(*)::int FROM public.trainer_profile AS profile
         JOIN public."user" AS app_user ON app_user.id = profile.user_id
        WHERE app_user.email LIKE 'mteam.verify.%@example.com') AS trainer_profiles,
       (SELECT COUNT(*)::int FROM public.membership_price
        WHERE amount IN (920925.11, 920925.12)) AS membership_prices,
       (SELECT COUNT(*)::int FROM public.payment
        WHERE receipt_number LIKE 'TEST-SUPABASE-VERIFY-20260925%') AS payments,
       (SELECT COUNT(*)::int FROM public.branch
        WHERE name LIKE 'TEST-SUPABASE-VERIFY-20260925%') AS branches,
       (SELECT COUNT(DISTINCT schedule_id)::int FROM public.scheduled_class
        WHERE activity LIKE 'TEST-SUPABASE-VERIFY-20260925%') AS weekly_schedules,
       (SELECT COUNT(*)::int FROM public.scheduled_class
        WHERE activity LIKE 'TEST-SUPABASE-VERIFY-20260925%') AS scheduled_classes,
       (SELECT COUNT(*)::int FROM public.user_audit_log AS audit
         JOIN public."user" AS app_user ON app_user.id = audit.user_id
        WHERE app_user.email LIKE 'mteam.verify.%@example.com') AS user_audit_logs`,
  );
  console.log(
    `verification_marker_counts=${JSON.stringify(verificationMarkerResult.rows[0])}`,
  );

  const securityResult = await client.query(
    `SELECT c.relname AS table_name,
            c.relrowsecurity AS rls_enabled,
            EXISTS (
              SELECT 1
                FROM information_schema.role_table_grants AS grants
               WHERE grants.table_schema = namespace.nspname
                 AND grants.table_name = c.relname
                 AND grants.grantee = 'anon'
                 AND grants.privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
            ) AS anon_has_dml,
            EXISTS (
              SELECT 1
                FROM information_schema.role_table_grants AS grants
               WHERE grants.table_schema = namespace.nspname
                 AND grants.table_name = c.relname
                 AND grants.grantee = 'authenticated'
                 AND grants.privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
            ) AS authenticated_has_dml
       FROM pg_class AS c
       JOIN pg_namespace AS namespace ON namespace.oid = c.relnamespace
      WHERE namespace.nspname = 'public'
        AND c.relkind = 'r'
      ORDER BY c.relname`,
  );
  console.log(`table_security=${JSON.stringify(securityResult.rows)}`);

  const ownerCapabilityResult = await client.query(
    `SELECT bool_and(pg_get_userbyid(c.relowner) = current_user) AS owns_all_tables,
            bool_and(has_table_privilege(
              current_user,
              format('%I.%I', namespace.nspname, c.relname),
              'SELECT,INSERT,UPDATE,DELETE'
            )) AS has_all_table_dml,
            has_schema_privilege(current_user, 'public', 'USAGE,CREATE')
              AS has_public_schema_usage_and_create
       FROM pg_class AS c
       JOIN pg_namespace AS namespace ON namespace.oid = c.relnamespace
      WHERE namespace.nspname = 'public'
        AND c.relkind = 'r'`,
  );
  console.log(`prisma_role_capabilities=${JSON.stringify(ownerCapabilityResult.rows[0])}`);

  const roleProbeResults = {};
  for (const role of ["anon", "authenticated"]) {
    const roleResult = await client.query(
      "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) AS present",
      [role],
    );
    if (!roleResult.rows[0].present) {
      roleProbeResults[role] = "role-not-present";
      continue;
    }

    await client.query("BEGIN");
    try {
      await client.query(`SET LOCAL ROLE "${role}"`);
      await client.query('SELECT 1 FROM public."user" LIMIT 1');
      roleProbeResults[role] = "unexpectedly-allowed";
    } catch (error) {
      roleProbeResults[role] = `denied:${error?.code ?? "unknown"}`;
    } finally {
      await client.query("ROLLBACK");
    }
  }
  console.log(`direct_role_probes=${JSON.stringify(roleProbeResults)}`);
} catch (error) {
  console.error("connection=failed");
  console.error(`error_code=${error?.code ?? "unknown"}`);
  console.error(
    `direct_url_shape=${JSON.stringify(describeConnection(process.env.DIRECT_URL))}`,
  );
  console.error(
    `database_url_shape=${JSON.stringify(describeConnection(process.env.DATABASE_URL))}`,
  );
  console.error(
    `direct_url_dns=${JSON.stringify(await describeDns(process.env.DIRECT_URL))}`,
  );
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
