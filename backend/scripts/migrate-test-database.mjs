import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

if (process.env.APP_ENV !== "test") {
  throw new Error("Set APP_ENV=test before running test database migrations.");
}

const projectDirectory = process.cwd();
config({ path: resolve(projectDirectory, ".env.test.local"), override: false, quiet: true });

const databaseVariables = ["DATABASE_URL", "DIRECT_URL", "NOTIFICATION_TEST_DATABASE_URL"];
const targets = databaseVariables.map((name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for isolated test database migrations.`);

  const target = new URL(value);
  if (!["postgres:", "postgresql:"].includes(target.protocol)) {
    throw new Error(`${name} must be a PostgreSQL URL.`);
  }
  const isLoopback = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(target.hostname);
  const databaseName = decodeURIComponent(target.pathname.slice(1)).toLowerCase();
  if (!isLoopback || databaseName !== "mteam_test" || target.port !== "55432") {
    throw new Error(`${name} must target the disposable local Compose database mteam_test on port 55432.`);
  }
  return `${target.hostname}:${target.port}/${databaseName}`;
});

if (new Set(targets).size !== 1) {
  throw new Error("DATABASE_URL, DIRECT_URL, and NOTIFICATION_TEST_DATABASE_URL must target the same local test database.");
}

const composeFile = resolve(projectDirectory, "docker-compose.test.yml");
const migrationsDirectory = resolve(projectDirectory, "prisma/migrations");
if (!existsSync(composeFile) || !existsSync(migrationsDirectory)) {
  throw new Error("Run this script from the backend directory containing docker-compose.test.yml and prisma/migrations.");
}

const dockerCliCandidates = process.platform === "win32"
  ? ["C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe"]
  : process.platform === "darwin"
    ? ["/Applications/Docker.app/Contents/Resources/bin/docker"]
    : ["/usr/bin/docker", "/usr/local/bin/docker"];
const dockerCliPath = dockerCliCandidates.find(existsSync);
if (!dockerCliPath) {
  throw new Error("Docker CLI was not found in a supported system installation directory.");
}

const safePath = process.platform === "win32"
  ? "C:\\Windows\\System32;C:\\Windows"
  : "/usr/bin:/bin:/usr/sbin:/sbin";

function runPsql(sql) {
  const result = spawnSync(dockerCliPath, [
    "compose", "-f", composeFile, "exec", "-T", "postgres-test", "psql",
    "-v", "ON_ERROR_STOP=1", "-A", "-t", "-F", "|",
    "-U", "mteam_test", "-d", "mteam_test", "-f", "-",
  ], {
    input: sql,
    encoding: "utf8",
    env: { ...process.env, PATH: safePath },
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || "psql failed while applying the isolated test migrations.");
  }
  return result.stdout.trim();
}

runPsql(`CREATE TABLE IF NOT EXISTS _prisma_migrations (
  id VARCHAR(36) PRIMARY KEY,
  checksum VARCHAR(64) NOT NULL,
  finished_at TIMESTAMPTZ,
  migration_name VARCHAR(255) NOT NULL,
  logs TEXT,
  rolled_back_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_steps_count INTEGER NOT NULL DEFAULT 0
);`);

const migrations = readdirSync(migrationsDirectory, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^\d{14}_[a-z0-9_]+$/.test(entry.name))
  .map((entry) => entry.name)
  .sort();

for (const migrationName of migrations) {
  const migrationPath = resolve(migrationsDirectory, migrationName, "migration.sql");
  if (!existsSync(migrationPath)) continue;

  const sql = readFileSync(migrationPath, "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex");
  const previous = runPsql(`SELECT checksum, COALESCE(finished_at::text, ''), COALESCE(rolled_back_at::text, '')
    FROM _prisma_migrations WHERE migration_name = '${migrationName}'
    ORDER BY started_at DESC LIMIT 1;`);

  if (previous) {
    const [previousChecksum, finishedAt, rolledBackAt] = previous.split("|");
    if (!rolledBackAt) {
      if (previousChecksum !== checksum) {
        throw new Error(`Checksum mismatch for already applied test migration ${migrationName}.`);
      }
      if (!finishedAt) {
        throw new Error(`Test migration ${migrationName} has an unfinished record; discard and recreate the disposable database.`);
      }
      console.log(`Already applied: ${migrationName}`);
      continue;
    }
  }

  const id = randomUUID();
  const migrationAndRecord = `BEGIN;\n${sql}\nINSERT INTO _prisma_migrations
    (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
    VALUES ('${id}', '${checksum}', now(), '${migrationName}', now(), 1);\nCOMMIT;`;
  runPsql(migrationAndRecord);
  console.log(`Applied: ${migrationName}`);
}

console.log(`Test database is up to date (${migrations.length} migration folders checked).`);
