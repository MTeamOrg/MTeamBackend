// Prepares a DISPOSABLE LOCAL PostgreSQL database for the browser test that runs the frontend against
// this real backend (frontend repository: e2e/real-backend). It creates one administrator, two members,
// one trainer, a branch and a pending medical certificate, and removes whatever a previous run of this
// script (or of that browser test) left behind. Rows are identified by the "@e2e.m-team.test" email
// domain and the branch name, so nothing else in the database is touched.
//
// Usage (from backend/):
//   NOTIFICATION_TEST_DATABASE_URL=postgresql://user:password@localhost:5432/mteam_test \
//     node scripts/seed-notification-e2e.mjs --out ./e2e-fixture.json
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import bcrypt from "bcrypt";
import pg from "pg";

const PASSWORD = "TestPassword123!";
const EMAIL_DOMAIN = "@e2e.m-team.test";
const BRANCH_NAME = "Sede E2E Notificaciones";
const BCRYPT_SALT_ROUNDS = 12; // same cost as the API, so the login path is the real one

const connectionString = process.env.NOTIFICATION_TEST_DATABASE_URL;
if (!connectionString) {
  console.error("Set NOTIFICATION_TEST_DATABASE_URL to a disposable local PostgreSQL database.");
  process.exit(2);
}
const url = new URL(connectionString);
const databaseName = decodeURIComponent(url.pathname.slice(1)).toLowerCase();
if (!["localhost", "127.0.0.1"].includes(url.hostname) || !databaseName.includes("test")) {
  console.error("Refusing to run: only a loopback PostgreSQL database with 'test' in its name is accepted.");
  process.exit(3);
}

const outIndex = process.argv.indexOf("--out");
const outPath = outIndex >= 0 ? process.argv[outIndex + 1] : undefined;

const client = new pg.Client({ connectionString });
await client.connect();

const e2eUsers = `(SELECT id FROM "user" WHERE email LIKE '%${EMAIL_DOMAIN}')`;
const e2eBranch = `(SELECT id FROM branch WHERE name = '${BRANCH_NAME}')`;

async function removePreviousFixture() {
  const statements = [
    `DELETE FROM notification WHERE user_id IN ${e2eUsers}`,
    `DELETE FROM medical_certificate WHERE member_id IN ${e2eUsers} OR reviewed_by_id IN ${e2eUsers}`,
    `DELETE FROM payment WHERE member_id IN ${e2eUsers} OR created_by_id IN ${e2eUsers} OR confirmed_by_id IN ${e2eUsers} OR voided_by_id IN ${e2eUsers}`,
    `DELETE FROM membership_price WHERE created_by_id IN ${e2eUsers}`,
    `DELETE FROM event WHERE created_by_id IN ${e2eUsers}`,
    `DELETE FROM news_post WHERE created_by_id IN ${e2eUsers}`,
    `DELETE FROM scheduled_class WHERE trainer_id IN ${e2eUsers} OR branch_id IN ${e2eBranch}`,
    `DELETE FROM trainer_branch WHERE trainer_id IN ${e2eUsers} OR branch_id IN ${e2eBranch}`,
    `DELETE FROM access_log WHERE user_id IN ${e2eUsers} OR branch_id IN ${e2eBranch}`,
    `DELETE FROM access_point WHERE branch_id IN ${e2eBranch}`,
    `DELETE FROM user_audit_log WHERE user_id IN ${e2eUsers} OR performed_by_id IN ${e2eUsers}`,
    `DELETE FROM branch WHERE name = '${BRANCH_NAME}'`,
    `DELETE FROM member_profile WHERE user_id IN ${e2eUsers}`,
    `DELETE FROM trainer_profile WHERE user_id IN ${e2eUsers}`,
    `DELETE FROM "user" WHERE email LIKE '%${EMAIL_DOMAIN}'`,
  ];
  for (const statement of statements) await client.query(statement);
}

const passwordHash = await bcrypt.hash(PASSWORD, BCRYPT_SALT_ROUNDS);

async function insertUser(role, slug, firstName, lastName) {
  const id = randomUUID();
  const email = `${slug}${EMAIL_DOMAIN}`;
  await client.query(
    `INSERT INTO "user" (id, first_name, last_name, document_number, birth_date, email, phone, password_hash, role, status, is_password_change_required, updated_at)
     VALUES ($1, $2, $3, $4, '1990-01-01', $5, '+54 11 5555-0100', $6, $7, 'ACTIVE', false, now())`,
    [id, firstName, lastName, `E2E-${slug.toUpperCase()}`.slice(0, 30), email, passwordHash, role],
  );
  if (role === "MEMBER") {
    await client.query(
      "INSERT INTO member_profile (id, user_id, emergency_contact_name, emergency_contact_phone) VALUES ($1, $2, 'Contacto E2E', '+54 11 5555-0101')",
      [randomUUID(), id],
    );
  }
  if (role === "TRAINER") {
    await client.query(
      "INSERT INTO trainer_profile (id, user_id, specialty, description) VALUES ($1, $2, 'Funcional', 'Entrenador de la prueba E2E')",
      [randomUUID(), id],
    );
  }
  return { id, email };
}

let fixture;
try {
  await client.query("BEGIN");
  await removePreviousFixture();

  const admin = await insertUser("ADMIN", "admin", "Ada", "Administradora");
  const member = await insertUser("MEMBER", "socio", "Sofía", "Socia");
  const otherMember = await insertUser("MEMBER", "otro.socio", "Omar", "Otro");
  const trainer = await insertUser("TRAINER", "entrenador", "Tomás", "Entrenador");

  const branchId = randomUUID();
  await client.query(
    `INSERT INTO branch (id, name, description, image_url, address, opening_hours, phone, is_active)
     VALUES ($1, $2, 'Sede de la prueba E2E', 'https://example.test/e2e-branch.png', 'E2E Notificaciones 123', '08:00-20:00', '+54 11 5555-0102', true)`,
    [branchId, BRANCH_NAME],
  );

  // The member paid 27 days ago, so the fee expires in 3 days: "Cuota próxima a vencer". The other member never paid.
  await client.query(
    `INSERT INTO payment (id, member_id, amount, method, status, created_by_id, confirmed_by_id, accredited_at, expires_at)
     VALUES ($1, $2, 20000.00, 'CASH', 'ACCREDITED', $3, $3, now() - interval '27 days', now() - interval '27 days' + interval '30 days')`,
    [randomUUID(), member.id, admin.id],
  );

  const certificateId = randomUUID();
  await client.query(
    "INSERT INTO medical_certificate (id, member_id, file_url, status) VALUES ($1, $2, $3, 'PENDING')",
    [certificateId, member.id, `${member.id}/e2e-fixture.pdf`],
  );

  await client.query("COMMIT");
  fixture = {
    password: PASSWORD,
    admin,
    member,
    otherMember,
    trainer,
    branch: { id: branchId, name: BRANCH_NAME },
    certificateId,
    // Lets the browser test check what it stored directly in this local database (it resolves `pg` from backendDir).
    backendDir: fileURLToPath(new URL("..", import.meta.url)),
    databaseUrl: connectionString,
  };
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}

if (outPath) writeFileSync(outPath, `${JSON.stringify(fixture, null, 2)}\n`);
console.log(`E2E fixture ready (${Object.keys(fixture).length} entries)${outPath ? `, written to ${outPath}` : ""}.`);
