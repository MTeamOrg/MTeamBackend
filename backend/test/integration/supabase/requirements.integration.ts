import { spawn, type ChildProcess } from "node:child_process";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { config } from "dotenv";
import pg from "pg";

const backendRoot = resolve(process.cwd());
config({
  path: [
    resolve(backendRoot, ".env.integration.supabase.local"),
    resolve(backendRoot, ".env.bootstrap.local"),
    resolve(backendRoot, ".env.smoke.local"),
    resolve(backendRoot, ".env.development.local"),
    resolve(backendRoot, ".env"),
  ],
  override: false,
  quiet: true,
});

const MARKER = "TEST-SUPABASE-VERIFY-20260925";
const suffix = `${Date.now()}-${randomBytes(3).toString("hex")}`;
const runId = `${MARKER}-${suffix}`;
const emailSuffix = `${Date.now()}.${randomBytes(3).toString("hex")}`;
const documentBase = 970_000_000 + randomInt(1_000_000);
const port = 32_000 + randomInt(1_000);
const apiBaseUrl = `http://127.0.0.1:${port}/api`;

const expectedTables = [
  "access_log",
  "access_point",
  "branch",
  "event",
  "medical_certificate",
  "member_profile",
  "membership_price",
  "news_post",
  "notification",
  "payment",
  "scheduled_class",
  "trainer_branch",
  "trainer_profile",
  "user",
  "user_audit_log",
  "weekly_schedule",
];

interface ApiResponse {
  status: number;
  payload: any;
}

interface ApiOptions {
  method?: string;
  token?: string;
  body?: unknown;
  expected?: number[];
  label?: string;
}

const state: Record<string, any> = {};
let databasePool: pg.Pool;
let backendProcess: ChildProcess | undefined;

function requiredEnvironment(): void {
  const required = [
    "DATABASE_URL",
    "DIRECT_URL",
    "JWT_SECRET",
    "BOOTSTRAP_ADMIN_EMAIL",
    "BOOTSTRAP_ADMIN_PASSWORD",
  ];
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Missing Supabase integration environment variables: ${missing.join(", ")}. ` +
      "Configure ignored local environment files before running this command.",
    );
  }
}

async function api(path: string, options: ApiOptions = {}): Promise<ApiResponse> {
  const method = options.method ?? "GET";
  const expected = options.expected ?? [200];
  const headers: Record<string, string> = { accept: "application/json" };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers["content-type"] = "application/json";

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  let payload: any = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  if (!expected.includes(response.status)) {
    throw new Error(
      `${options.label ?? `${method} ${path}`} returned status ${response.status}; ` +
      `expected ${expected.join(" or ")}`,
    );
  }
  return { status: response.status, payload };
}

function accessToken(response: ApiResponse, label: string): string {
  const token = response.payload?.accessToken;
  if (typeof token !== "string" || token.length === 0) {
    throw new Error(`${label} did not return an access token`);
  }
  return token;
}

async function login(email: string, password: string, expected = [200]): Promise<ApiResponse> {
  return api("/auth/login", {
    method: "POST",
    body: { email, password },
    expected,
    label: "login",
  });
}

async function waitForBackend(): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (backendProcess?.exitCode !== null && backendProcess?.exitCode !== undefined) {
      throw new Error(`Backend exited before becoming ready (code ${backendProcess.exitCode})`);
    }
    try {
      const response = await fetch(`${apiBaseUrl}/health`);
      if (response.status === 200) return;
    } catch {
      // The server can refuse connections during startup.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 150));
  }
  throw new Error("Backend did not become ready within 30 seconds");
}

async function startBackend(): Promise<void> {
  backendProcess = spawn(process.execPath, ["dist/index.js"], {
    cwd: backendRoot,
    env: {
      ...process.env,
      APP_ENV: "development",
      NODE_ENV: "development",
      PORT: String(port),
    },
    stdio: "ignore",
  });
  await waitForBackend();
}

async function stopBackend(): Promise<void> {
  const processToStop = backendProcess;
  backendProcess = undefined;
  if (!processToStop || processToStop.exitCode !== null) return;
  processToStop.kill();
  await new Promise<void>((resolveStop) => {
    const timeout = setTimeout(() => resolveStop(), 5_000);
    processToStop.once("exit", () => {
      clearTimeout(timeout);
      resolveStop();
    });
  });
  if (processToStop.exitCode === null) processToStop.kill("SIGKILL");
}

function password(): string {
  return `T3st!${randomBytes(12).toString("base64url")}`;
}

function documentNumber(offset: number): string {
  return String(documentBase + offset);
}

function addUtcDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function futureMonday(): string {
  const value = new Date();
  value.setUTCFullYear(value.getUTCFullYear() + 5);
  value.setUTCHours(0, 0, 0, 0);
  const daysUntilMonday = (8 - value.getUTCDay()) % 7;
  value.setUTCDate(value.getUTCDate() + daysUntilMonday);
  return value.toISOString().slice(0, 10);
}

async function availableFutureMonday(): Promise<string> {
  let candidate = addUtcDays(futureMonday(), randomInt(20, 520) * 7);
  for (let attempt = 0; attempt < 520; attempt += 1) {
    const followingWeek = addUtcDays(candidate, 7);
    const existing = await databasePool.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
         FROM public.weekly_schedule
        WHERE week_starts_on IN ($1::date, $2::date)`,
      [candidate, followingWeek],
    );
    if (existing.rows[0]!.count === 0) return candidate;
    candidate = addUtcDays(candidate, 14);
  }
  throw new Error("Could not find two unused future weeks for integration data");
}

function buenosAiresParts(value: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

beforeAll(async () => {
  requiredEnvironment();
  databasePool = new pg.Pool({ connectionString: process.env.DIRECT_URL });
  await databasePool.query("SELECT 1");
  await startBackend();

  const adminLogin = await login(
    process.env.BOOTSTRAP_ADMIN_EMAIL!,
    process.env.BOOTSTRAP_ADMIN_PASSWORD!,
  );
  state.adminToken = accessToken(adminLogin, "administrator login");
  state.adminId = adminLogin.payload.user.id;
}, 60_000);

afterAll(async () => {
  await stopBackend();
  await databasePool?.end();
});

describe("real Supabase requirements verification", () => {
  test("schema, migrations, owner access and Data API isolation are intact", async () => {
    const tableResult = await databasePool.query<{ table_name: string }>(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name`,
    );
    const appTables = tableResult.rows
      .map((row) => row.table_name)
      .filter((name) => name !== "_prisma_migrations");
    expect(appTables).toEqual(expectedTables);

    const migrationResult = await databasePool.query<{
      migration_name: string;
      checksum: string;
      finished: boolean;
      rolled_back: boolean;
    }>(
      `SELECT migration_name, checksum,
              finished_at IS NOT NULL AS finished,
              rolled_back_at IS NOT NULL AS rolled_back
         FROM public._prisma_migrations
        ORDER BY started_at`,
    );
    expect(migrationResult.rows).toHaveLength(3);
    for (const migration of migrationResult.rows) {
      const sql = await readFile(resolve(
        backendRoot,
        "prisma",
        "migrations",
        migration.migration_name,
        "migration.sql",
      ), "utf8");
      const rawChecksum = createHash("sha256").update(Buffer.from(sql, "utf8")).digest("hex");
      const normalizedChecksum = createHash("sha256")
        .update(Buffer.from(sql.replaceAll("\r\n", "\n"), "utf8"))
        .digest("hex");
      expect(migration.finished).toBe(true);
      expect(migration.rolled_back).toBe(false);
      expect([rawChecksum, normalizedChecksum]).toContain(migration.checksum);
    }

    const securityResult = await databasePool.query<{
      table_name: string;
      rls_enabled: boolean;
      anon_has_dml: boolean;
      authenticated_has_dml: boolean;
    }>(
      `SELECT c.relname AS table_name,
              c.relrowsecurity AS rls_enabled,
              has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') AS anon_has_dml,
              has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
                AS authenticated_has_dml
         FROM pg_class AS c
         JOIN pg_namespace AS n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        ORDER BY c.relname`,
    );
    expect(securityResult.rows).toHaveLength(17);
    expect(securityResult.rows.every((row) =>
      row.rls_enabled && !row.anon_has_dml && !row.authenticated_has_dml)).toBe(true);

    const ownerResult = await databasePool.query<{
      owns_all: boolean;
      has_all_dml: boolean;
    }>(
      `SELECT bool_and(pg_get_userbyid(c.relowner) = current_user) AS owns_all,
              bool_and(has_table_privilege(current_user, c.oid, 'SELECT,INSERT,UPDATE,DELETE'))
                AS has_all_dml
         FROM pg_class AS c
         JOIN pg_namespace AS n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'`,
    );
    expect(ownerResult.rows[0]).toEqual({ owns_all: true, has_all_dml: true });

    const client = await databasePool.connect();
    try {
      for (const role of ["anon", "authenticated"] as const) {
        await client.query("BEGIN");
        let errorCode: string | undefined;
        try {
          await client.query(`SET LOCAL ROLE "${role}"`);
          await client.query("DELETE FROM public.branch WHERE FALSE");
        } catch (error: any) {
          errorCode = error?.code;
        } finally {
          await client.query("ROLLBACK");
        }
        expect(errorCode).toBe("42501");
      }
    } finally {
      client.release();
    }
  });

  test("users, profiles, authentication, authorization and audit work against Supabase", async () => {
    expect((await api("/users", { expected: [401] })).status).toBe(401);

    state.member = {
      firstName: "TEST SUPABASE",
      lastName: `VERIFY MEMBER ${suffix}`,
      documentNumber: documentNumber(1),
      birthDate: "1992-04-03",
      email: `mteam.verify.member.${emailSuffix}@example.com`,
      phone: "+54 11 5555-4101",
      password: password(),
      emergencyContactName: runId,
      emergencyContactPhone: "+54 11 5555-4191",
    };
    const registration = await api("/auth/register", {
      method: "POST",
      body: state.member,
      expected: [201],
    });
    state.memberId = registration.payload.id;
    expect(registration.payload).toMatchObject({
      email: state.member.email,
      documentNumber: state.member.documentNumber,
      role: "MEMBER",
      status: "ACTIVE",
      isPasswordChangeRequired: false,
    });

    expect((await api("/auth/register", {
      method: "POST",
      body: { ...state.member, documentNumber: documentNumber(2) },
      expected: [409],
    })).status).toBe(409);
    expect((await api("/auth/register", {
      method: "POST",
      body: {
        ...state.member,
        email: `mteam.verify.duplicate.${emailSuffix}@example.com`,
      },
      expected: [409],
    })).status).toBe(409);

    expect((await login(state.member.email, password(), [401])).status).toBe(401);
    let memberLogin = await login(state.member.email, state.member.password);
    state.memberToken = accessToken(memberLogin, "member login");
    expect((await api("/users", { token: state.memberToken, expected: [403] })).status).toBe(403);

    const profile = await api("/users/me", { token: state.memberToken });
    expect(profile.payload.memberProfile).toMatchObject({
      emergencyContactName: runId,
      emergencyContactPhone: state.member.emergencyContactPhone,
    });
    const updatedEmail = `mteam.verify.member.updated.${emailSuffix}@example.com`;
    const updatedProfile = await api("/users/me", {
      method: "PATCH",
      token: state.memberToken,
      body: {
        email: updatedEmail,
        phone: "+54 11 5555-4109",
        emergencyContactName: `${runId}-UPDATED`,
      },
    });
    expect(updatedProfile.payload).toMatchObject({
      email: updatedEmail,
      phone: "+54 11 5555-4109",
      memberProfile: { emergencyContactName: `${runId}-UPDATED` },
    });
    state.member.email = updatedEmail;
    expect((await api("/users/me", {
      method: "PATCH",
      token: state.memberToken,
      body: { role: "ADMIN" },
      expected: [400],
    })).status).toBe(400);

    state.trainer = {
      firstName: "TEST SUPABASE",
      lastName: `VERIFY TRAINER ${suffix}`,
      documentNumber: documentNumber(3),
      birthDate: "1988-06-07",
      email: `mteam.verify.trainer.${emailSuffix}@example.com`,
      phone: "+54 11 5555-4201",
      password: password(),
      role: "TRAINER",
      specialty: runId,
      description: `${runId} integration trainer`,
    };
    const trainerCreated = await api("/users", {
      method: "POST",
      token: state.adminToken,
      body: state.trainer,
      expected: [201],
    });
    state.trainerId = trainerCreated.payload.id;
    expect(trainerCreated.payload.isPasswordChangeRequired).toBe(true);
    let trainerLogin = await login(state.trainer.email, state.trainer.password);
    state.trainerToken = accessToken(trainerLogin, "trainer temporary login");
    expect((await api("/users/me", {
      token: state.trainerToken,
      expected: [403],
    })).status).toBe(403);
    const trainerNewPassword = password();
    await api("/auth/password", {
      method: "PATCH",
      token: state.trainerToken,
      body: { currentPassword: state.trainer.password, newPassword: trainerNewPassword },
      expected: [204],
    });
    state.trainer.password = trainerNewPassword;
    trainerLogin = await login(state.trainer.email, state.trainer.password);
    state.trainerToken = accessToken(trainerLogin, "trainer login after password change");
    expect((await api("/users", {
      token: state.trainerToken,
      expected: [403],
    })).status).toBe(403);

    const racePassword = password();
    state.raceMember = {
      firstName: "TEST SUPABASE",
      lastName: `VERIFY RACE ${suffix}`,
      documentNumber: documentNumber(4),
      birthDate: "1994-01-02",
      email: `mteam.verify.race.${emailSuffix}@example.com`,
      phone: "+54 11 5555-4301",
      password: racePassword,
      role: "MEMBER",
      emergencyContactName: runId,
      emergencyContactPhone: "+54 11 5555-4391",
    };
    const raceResults = await Promise.all([
      api("/users", {
        method: "POST",
        token: state.adminToken,
        body: state.raceMember,
        expected: [201, 409],
      }),
      api("/users", {
        method: "POST",
        token: state.adminToken,
        body: state.raceMember,
        expected: [201, 409],
      }),
    ]);
    expect(raceResults.map((result) => result.status).sort()).toEqual([201, 409]);
    state.raceMemberId = raceResults.find((result) => result.status === 201)!.payload.id;
    const raceDatabase = await databasePool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM public."user" WHERE email = $1) AS users,
         (SELECT COUNT(*)::int FROM public.member_profile mp
           JOIN public."user" u ON u.id = mp.user_id WHERE u.email = $1) AS profiles,
         (SELECT COUNT(*)::int FROM public.user_audit_log l
           JOIN public."user" u ON u.id = l.user_id
          WHERE u.email = $1 AND l.action = 'CREATED') AS audit_logs`,
      [state.raceMember.email],
    );
    expect(raceDatabase.rows[0]).toEqual({ users: 1, profiles: 1, audit_logs: 1 });

    const adminTestPassword = password();
    const adminTest = await api("/users", {
      method: "POST",
      token: state.adminToken,
      body: {
        firstName: "TEST SUPABASE",
        lastName: `VERIFY ADMIN ${suffix}`,
        documentNumber: documentNumber(5),
        birthDate: "1980-05-05",
        email: `mteam.verify.admin.${emailSuffix}@example.com`,
        phone: "+54 11 5555-4401",
        password: adminTestPassword,
        role: "ADMIN",
      },
      expected: [201],
    });
    expect(adminTest.payload.role).toBe("ADMIN");

    const expiringPassword = password();
    state.expiringMember = {
      firstName: "TEST SUPABASE",
      lastName: `VERIFY EXPIRING ${suffix}`,
      documentNumber: documentNumber(6),
      birthDate: "1991-03-04",
      email: `mteam.verify.expiring.${emailSuffix}@example.com`,
      phone: "+54 11 5555-4501",
      password: expiringPassword,
      role: "MEMBER",
      emergencyContactName: runId,
      emergencyContactPhone: "+54 11 5555-4591",
    };
    const expiringCreated = await api("/users", {
      method: "POST",
      token: state.adminToken,
      body: state.expiringMember,
      expected: [201],
    });
    state.expiringMemberId = expiringCreated.payload.id;

    const list = await api(
      `/users?search=${encodeURIComponent("VERIFY")}&role=MEMBER&status=ACTIVE&page=1&limit=1`,
      { token: state.adminToken },
    );
    expect(list.payload.page).toBe(1);
    expect(list.payload.limit).toBe(1);
    expect(list.payload.total).toBeGreaterThanOrEqual(3);
    expect(list.payload.items).toHaveLength(1);

    const updatedTrainer = await api(`/users/${state.trainerId}`, {
      method: "PATCH",
      token: state.adminToken,
      body: {
        specialty: `${runId}-UPDATED`,
        phone: "+54 11 5555-4209",
        reason: `${runId} administrative update`,
      },
    });
    expect(updatedTrainer.payload).toMatchObject({
      phone: "+54 11 5555-4209",
      trainerProfile: { specialty: `${runId}-UPDATED` },
    });
    const trainerDetail = await api(`/users/${state.trainerId}`, { token: state.adminToken });
    expect(trainerDetail.payload.trainerProfile.description).toContain(MARKER);

    await api(`/users/${state.memberId}/status`, {
      method: "PATCH",
      token: state.adminToken,
      body: { status: "INACTIVE", reason: `${runId} inactive verification` },
    });
    expect((await login(state.member.email, state.member.password, [403])).status).toBe(403);
    expect((await api("/users/me", {
      token: state.memberToken,
      expected: [403],
    })).status).toBe(403);
    await api(`/users/${state.memberId}/status`, {
      method: "PATCH",
      token: state.adminToken,
      body: { status: "ACTIVE", reason: `${runId} reactivation verification` },
    });
    memberLogin = await login(state.member.email, state.member.password);
    state.memberToken = accessToken(memberLogin, "reactivated member login");

    const temporaryPassword = password();
    await api(`/users/${state.memberId}/password-resets`, {
      method: "POST",
      token: state.adminToken,
      body: { temporaryPassword },
      expected: [204],
    });
    const temporaryLogin = await login(state.member.email, temporaryPassword);
    const temporaryToken = accessToken(temporaryLogin, "temporary password login");
    expect((await api("/users/me", {
      token: temporaryToken,
      expected: [403],
    })).status).toBe(403);
    const finalPassword = password();
    await api("/auth/password", {
      method: "PATCH",
      token: temporaryToken,
      body: { currentPassword: temporaryPassword, newPassword: finalPassword },
      expected: [204],
    });
    state.member.password = finalPassword;
    memberLogin = await login(state.member.email, state.member.password);
    state.memberToken = accessToken(memberLogin, "member login after temporary password change");
    await api("/users/me", { token: state.memberToken });

    const audit = await api(`/users/${state.memberId}/audit-logs?page=1&limit=100`, {
      token: state.adminToken,
    });
    const actions = new Set(audit.payload.items.map((item: any) => item.action));
    expect([...actions]).toEqual(expect.arrayContaining([
      "CREATED", "UPDATED", "DEACTIVATED", "ACTIVATED", "PASSWORD_RESET",
    ]));
    expect(audit.payload.items.some((item: any) => item.performedBy.id === state.adminId)).toBe(true);
  });

  test("membership prices and payments preserve decimals, history, recalculation and transactions", async () => {
    // Keep both prices effective now while ensuring they sort after values left by a prior run.
    const effectiveOne = new Date(Date.now() - 2_000).toISOString();
    const effectiveTwo = new Date(Date.now() - 1_000).toISOString();
    const priceOne = await api("/membership-prices", {
      method: "POST",
      token: state.adminToken,
      body: { amount: 920925.11, effectiveFrom: effectiveOne },
      expected: [201],
    });
    const priceTwo = await api("/membership-prices", {
      method: "POST",
      token: state.adminToken,
      body: { amount: 920925.12, effectiveFrom: effectiveTwo },
      expected: [201],
    });
    state.priceIds = [priceOne.payload.id, priceTwo.payload.id];
    expect(priceOne.payload.amount).toBe("920925.11");
    expect(priceTwo.payload).toMatchObject({ amount: "920925.12", previousAmount: "920925.11" });

    const priceHistory = await api("/membership-prices?page=1&limit=100", {
      token: state.adminToken,
    });
    expect(state.priceIds.every((id: string) =>
      priceHistory.payload.items.some((item: any) => item.id === id))).toBe(true);
    const currentPrice = await api("/membership-prices/current", { token: state.memberToken });
    expect(currentPrice.payload.id).toBe(priceTwo.payload.id);
    expect(currentPrice.payload.amount).toBe("920925.12");

    const beforePreview = await databasePool.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM public.payment WHERE member_id = $1",
      [state.memberId],
    );
    const preview = await api("/payments/previews", {
      method: "POST",
      token: state.adminToken,
      body: {
        memberId: state.memberId,
        amount: 43001.17,
        method: "TEST-TRANSFER",
        receiptNumber: `${runId}-PREVIEW`,
      },
    });
    expect(preview.payload).toMatchObject({
      currentPrice: "920925.12",
      amount: "43001.17",
      method: "TEST-TRANSFER",
      receiptNumber: `${runId}-PREVIEW`,
    });
    expect(
      new Date(preview.payload.estimatedExpiresAt).getTime() -
      new Date(preview.payload.estimatedAccreditedAt).getTime(),
    ).toBe(30 * 24 * 60 * 60 * 1000);
    const afterPreview = await databasePool.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM public.payment WHERE member_id = $1",
      [state.memberId],
    );
    expect(afterPreview.rows[0]!.count).toBe(beforePreview.rows[0]!.count);

    state.paymentRangeFrom = new Date(Date.now() - 5 * 60_000).toISOString();
    const paymentOne = await api("/payments", {
      method: "POST",
      token: state.adminToken,
      body: {
        memberId: state.memberId,
        amount: 43001.17,
        method: "TEST-TRANSFER",
        receiptNumber: `${runId}-PAY-1`,
      },
      expected: [201],
    });
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
    const paymentTwo = await api("/payments", {
      method: "POST",
      token: state.adminToken,
      body: {
        memberId: state.memberId,
        amount: 43001.29,
        method: "TEST-CARD",
        receiptNumber: `${runId}-PAY-2`,
      },
      expected: [201],
    });
    state.paymentOne = paymentOne.payload;
    state.paymentTwo = paymentTwo.payload;
    expect(paymentOne.payload.amount).toBe("43001.17");
    expect(paymentTwo.payload.amount).toBe("43001.29");
    for (const payment of [paymentOne.payload, paymentTwo.payload]) {
      expect(new Date(payment.expiresAt).getTime() - new Date(payment.accreditedAt).getTime())
        .toBe(30 * 24 * 60 * 60 * 1000);
    }

    let membership = await api("/members/me/membership", { token: state.memberToken });
    expect(membership.payload).toMatchObject({
      currentPrice: "920925.12",
      status: "CURRENT",
      expiresAt: paymentTwo.payload.expiresAt,
    });

    const ownHistory = await api("/members/me/payments?page=1&limit=1", {
      token: state.memberToken,
    });
    expect(ownHistory.payload).toMatchObject({ page: 1, limit: 1 });
    expect(ownHistory.payload.total).toBeGreaterThanOrEqual(2);
    expect(ownHistory.payload.items[0].id).toBe(paymentTwo.payload.id);
    const adminHistory = await api(
      `/members/${state.memberId}/payments?page=1&limit=100`,
      { token: state.adminToken },
    );
    expect(adminHistory.payload.items.map((item: any) => item.id))
      .toEqual(expect.arrayContaining([paymentOne.payload.id, paymentTwo.payload.id]));

    const filtered = await api(
      `/payments?memberId=${state.memberId}` +
      `&documentNumber=${state.member.documentNumber}` +
      `&method=${encodeURIComponent("TEST-CARD")}` +
      "&status=ACCREDITED&page=1&limit=1",
      { token: state.adminToken },
    );
    expect(filtered.payload.total).toBe(1);
    expect(filtered.payload.items[0].id).toBe(paymentTwo.payload.id);

    const voided = await api(`/payments/${paymentTwo.payload.id}/voids`, {
      method: "POST",
      token: state.adminToken,
      body: { reason: `${runId} intentional payment void` },
    });
    expect(voided.payload).toMatchObject({
      id: paymentTwo.payload.id,
      status: "VOIDED",
      voidReason: `${runId} intentional payment void`,
      voidedById: state.adminId,
    });
    expect((await api(`/payments/${paymentTwo.payload.id}/voids`, {
      method: "POST",
      token: state.adminToken,
      body: { reason: `${runId} duplicate void` },
      expected: [409],
    })).status).toBe(409);

    membership = await api("/members/me/membership", { token: state.memberToken });
    expect(membership.payload.expiresAt).toBe(paymentOne.payload.expiresAt);
    expect(membership.payload.lastPaymentAt).toBe(paymentOne.payload.accreditedAt);

    const paymentDatabase = await databasePool.query(
      `SELECT amount::text, status::text, created_by_id, confirmed_by_id,
              voided_by_id, voided_at IS NOT NULL AS has_voided_at,
              expires_at = accredited_at + INTERVAL '30 days' AS exact_expiration
         FROM public.payment
        WHERE id = $1`,
      [paymentTwo.payload.id],
    );
    expect(paymentDatabase.rows[0]).toEqual({
      amount: "43001.29",
      status: "VOIDED",
      created_by_id: state.adminId,
      confirmed_by_id: state.adminId,
      voided_by_id: state.adminId,
      has_voided_at: true,
      exact_expiration: true,
    });

    const accreditedAt = new Date(Date.now() - 27 * 24 * 60 * 60 * 1000);
    const expiresAt = new Date(accreditedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiringPayment = await databasePool.query<{ id: string }>(
      `INSERT INTO public.payment (
         id, member_id, amount, method, receipt_number, status,
         created_by_id, confirmed_by_id, accredited_at, expires_at
       ) VALUES (
         gen_random_uuid(), $1, $2, $3, $4, 'ACCREDITED', $5, $5, $6, $7
       ) RETURNING id`,
      [
        state.expiringMemberId,
        "43002.11",
        "TEST-FIXTURE",
        `${runId}-EXPIRING`,
        state.adminId,
        accreditedAt,
        expiresAt,
      ],
    );
    state.expiringPaymentId = expiringPayment.rows[0]!.id;

    const currentMembers = await api(
      `/members?membershipStatus=CURRENT&search=${encodeURIComponent(state.member.email)}`,
      { token: state.adminToken },
    );
    expect(currentMembers.payload.items.some((item: any) => item.id === state.memberId)).toBe(true);
    const expiringMembers = await api(
      `/members?membershipStatus=EXPIRING_SOON&search=${encodeURIComponent(state.expiringMember.email)}`,
      { token: state.adminToken },
    );
    expect(expiringMembers.payload.items.some((item: any) =>
      item.id === state.expiringMemberId && item.membershipStatus === "EXPIRING_SOON")).toBe(true);
    const expiredMembers = await api(
      `/members?membershipStatus=EXPIRED&search=${encodeURIComponent(state.raceMember.email)}`,
      { token: state.adminToken },
    );
    expect(expiredMembers.payload.items.some((item: any) =>
      item.id === state.raceMemberId && item.membershipStatus === "EXPIRED")).toBe(true);

    state.paymentRangeTo = new Date(Date.now() + 60_000).toISOString();
    const summary = await api(
      `/payments/summary?from=${encodeURIComponent(state.paymentRangeFrom)}` +
      `&to=${encodeURIComponent(state.paymentRangeTo)}`,
      { token: state.adminToken },
    );
    const aggregate = await databasePool.query<{ payment_count: number; total_amount: string }>(
      `SELECT COUNT(*)::int AS payment_count,
              COALESCE(SUM(amount), 0)::text AS total_amount
         FROM public.payment
        WHERE status = 'ACCREDITED' AND accredited_at >= $1 AND accredited_at < $2`,
      [state.paymentRangeFrom, state.paymentRangeTo],
    );
    expect(summary.payload.paymentCount).toBe(aggregate.rows[0]!.payment_count);
    expect(summary.payload.totalAmount).toBe(aggregate.rows[0]!.total_amount);
  });

  test("branches, active trainers and weekly classes enforce status and Buenos Aires time", async () => {
    state.branchInput = {
      name: `${runId} BRANCH`,
      address: `${runId} 1000, Buenos Aires`,
      openingHours: "TEST DATA 08:00-22:00",
      phone: "+54 11 5555-4601",
      description: `${runId} integration branch`,
      imageUrl: "https://example.com/mteam-supabase-verify.jpg",
      latitude: -34.603722,
      longitude: -58.381592,
    };
    const branch = await api("/branches", {
      method: "POST",
      token: state.adminToken,
      body: state.branchInput,
      expected: [201],
    });
    state.branchId = branch.payload.id;
    expect(branch.payload).toMatchObject({
      name: state.branchInput.name,
      latitude: "-34.603722",
      longitude: "-58.381592",
      isActive: true,
    });
    expect((await api("/branches", {
      method: "POST",
      token: state.adminToken,
      body: { ...state.branchInput, address: `${runId} duplicate address variant` },
      expected: [409],
    })).status).toBe(409);

    const updatedBranch = await api(`/branches/${state.branchId}`, {
      method: "PATCH",
      token: state.adminToken,
      body: {
        description: `${runId} updated branch`,
        phone: "+54 11 5555-4609",
      },
    });
    expect(updatedBranch.payload).toMatchObject({
      description: `${runId} updated branch`,
      phone: "+54 11 5555-4609",
    });

    const publicBranches = await api(
      `/branches?search=${encodeURIComponent(runId)}&page=1&limit=1`,
    );
    expect(publicBranches.payload).toMatchObject({ page: 1, limit: 1, total: 1 });
    expect(publicBranches.payload.items[0].id).toBe(state.branchId);
    const publicDetail = await api(`/branches/${state.branchId}`);
    expect(publicDetail.payload.description).toBe(`${runId} updated branch`);
    const adminBranches = await api(
      `/admin/branches?search=${encodeURIComponent(runId)}&isActive=true&page=1&limit=10`,
      { token: state.adminToken },
    );
    expect(adminBranches.payload.items.some((item: any) => item.id === state.branchId)).toBe(true);

    state.sourceWeek = await availableFutureMonday();
    state.destinationWeek = addUtcDays(state.sourceWeek, 7);
    const sourceClassDate = addUtcDays(state.sourceWeek, 1);
    const initialStartsAt = `${sourceClassDate}T18:45:00-03:00`;

    await api(`/branches/${state.branchId}/status`, {
      method: "PATCH",
      token: state.adminToken,
      body: { isActive: false },
    });
    const hiddenBranches = await api(`/branches?search=${encodeURIComponent(runId)}`);
    expect(hiddenBranches.payload.items).toHaveLength(0);
    expect((await api(`/branches/${state.branchId}`, { expected: [404] })).status).toBe(404);
    expect((await api("/scheduled-classes", {
      method: "POST",
      token: state.adminToken,
      body: {
        weekStartsOn: state.sourceWeek,
        activity: `${runId} INACTIVE BRANCH`,
        startsAt: initialStartsAt,
        branchId: state.branchId,
        trainerId: state.trainerId,
      },
      expected: [409],
    })).status).toBe(409);
    const absentSchedule = await api(`/weekly-schedules?weekStartsOn=${state.sourceWeek}`);
    expect(absentSchedule.payload).toMatchObject({ id: null, classes: [] });
    await api(`/branches/${state.branchId}/status`, {
      method: "PATCH",
      token: state.adminToken,
      body: { isActive: true },
    });

    const activeTrainers = await api("/trainers?page=1&limit=100");
    expect(activeTrainers.payload.items.some((item: any) =>
      item.id === state.trainerId && item.specialty === `${runId}-UPDATED`)).toBe(true);
    await api(`/users/${state.trainerId}/status`, {
      method: "PATCH",
      token: state.adminToken,
      body: { status: "INACTIVE", reason: `${runId} trainer assignment verification` },
    });
    expect((await api("/users/me", {
      token: state.trainerToken,
      expected: [403],
    })).status).toBe(403);
    const inactiveTrainers = await api("/trainers?page=1&limit=100");
    expect(inactiveTrainers.payload.items.some((item: any) => item.id === state.trainerId)).toBe(false);
    expect((await api("/scheduled-classes", {
      method: "POST",
      token: state.adminToken,
      body: {
        weekStartsOn: state.sourceWeek,
        activity: `${runId} INACTIVE TRAINER`,
        startsAt: initialStartsAt,
        branchId: state.branchId,
        trainerId: state.trainerId,
      },
      expected: [409],
    })).status).toBe(409);
    await api(`/users/${state.trainerId}/status`, {
      method: "PATCH",
      token: state.adminToken,
      body: { status: "ACTIVE", reason: `${runId} trainer reactivation` },
    });

    const scheduledClass = await api("/scheduled-classes", {
      method: "POST",
      token: state.adminToken,
      body: {
        weekStartsOn: state.sourceWeek,
        activity: `${runId} CLASS`,
        startsAt: initialStartsAt,
        branchId: state.branchId,
        trainerId: state.trainerId,
      },
      expected: [201],
    });
    state.classId = scheduledClass.payload.id;
    const updatedStartsAt = `${sourceClassDate}T19:15:00-03:00`;
    const updatedClass = await api(`/scheduled-classes/${state.classId}`, {
      method: "PATCH",
      token: state.adminToken,
      body: { activity: `${runId} CLASS UPDATED`, startsAt: updatedStartsAt },
    });
    expect(updatedClass.payload.activity).toBe(`${runId} CLASS UPDATED`);
    expect(buenosAiresParts(updatedClass.payload.startsAt))
      .toBe(`${sourceClassDate}T19:15`);

    const disposableClass = await api("/scheduled-classes", {
      method: "POST",
      token: state.adminToken,
      body: {
        weekStartsOn: state.sourceWeek,
        activity: `${runId} DELETE CLASS`,
        startsAt: `${addUtcDays(state.sourceWeek, 2)}T17:00:00-03:00`,
        branchId: state.branchId,
        trainerId: null,
      },
      expected: [201],
    });
    await api(`/scheduled-classes/${disposableClass.payload.id}`, {
      method: "DELETE",
      token: state.adminToken,
      expected: [204],
    });

    const sourceSchedule = await api(`/weekly-schedules?weekStartsOn=${state.sourceWeek}`);
    state.sourceScheduleId = sourceSchedule.payload.id;
    expect(sourceSchedule.payload.classes.map((item: any) => item.id))
      .toEqual([state.classId]);
    const sourceBeforeCopy = JSON.stringify(sourceSchedule.payload);
    const copied = await api(`/weekly-schedules/${state.sourceScheduleId}/copies`, {
      method: "POST",
      token: state.adminToken,
      body: { weekStartsOn: state.destinationWeek },
      expected: [201],
    });
    state.destinationScheduleId = copied.payload.id;
    state.copiedClassId = copied.payload.classes[0].id;
    expect(copied.payload.classes).toHaveLength(1);
    expect(copied.payload.classes[0].id).not.toBe(state.classId);
    expect(copied.payload.classes[0].activity).toBe(`${runId} CLASS UPDATED`);
    expect(buenosAiresParts(copied.payload.classes[0].startsAt))
      .toBe(`${addUtcDays(sourceClassDate, 7)}T19:15`);
    expect(JSON.stringify((await api(`/weekly-schedules/${state.sourceScheduleId}`)).payload))
      .toBe(sourceBeforeCopy);
    expect((await api(`/weekly-schedules/${state.sourceScheduleId}/copies`, {
      method: "POST",
      token: state.adminToken,
      body: { weekStartsOn: state.destinationWeek },
      expected: [409],
    })).status).toBe(409);

    const detailWithClass = await api(`/branches/${state.branchId}`);
    expect(detailWithClass.payload.scheduledClasses.some((item: any) =>
      item.id === state.classId || item.id === state.copiedClassId)).toBe(true);
    const copiedDatabase = await databasePool.query(
      `SELECT copied_from_id FROM public.weekly_schedule WHERE id = $1`,
      [state.destinationScheduleId],
    );
    expect(copiedDatabase.rows[0].copied_from_id).toBe(state.sourceScheduleId);
  });

  test("CLA-01 exposes the marked weekly schedule without authentication", async () => {
    if (!state.sourceWeek || !state.classId || !state.branchId || !state.trainerId) {
      throw new Error("CLA-01 prerequisites were not created by the preceding integration stage");
    }

    const schedule = await api(`/weekly-schedules?weekStartsOn=${state.sourceWeek}`);
    const scheduledClass = schedule.payload.classes.find(
      (item: any) => item.id === state.classId,
    );

    expect(scheduledClass).toMatchObject({
      id: state.classId,
      activity: `${runId} CLASS UPDATED`,
      day: addUtcDays(state.sourceWeek, 1),
      startTime: "19:15",
      branch: { id: state.branchId },
      trainer: { id: state.trainerId },
    });
  });

  test("records remain available after a real backend restart", async () => {
    if (!state.paymentOne || !state.paymentTwo || !state.destinationScheduleId) {
      throw new Error("Persistence prerequisites were not created by the preceding integration stages");
    }
    await stopBackend();
    await startBackend();

    const adminLogin = await login(
      process.env.BOOTSTRAP_ADMIN_EMAIL!,
      process.env.BOOTSTRAP_ADMIN_PASSWORD!,
    );
    state.adminToken = accessToken(adminLogin, "administrator login after restart");
    const memberLogin = await login(state.member.email, state.member.password);
    state.memberToken = accessToken(memberLogin, "member login after restart");

    const memberDetail = await api(`/users/${state.memberId}`, { token: state.adminToken });
    expect(memberDetail.payload.email).toBe(state.member.email);
    expect(memberDetail.payload.payments.map((item: any) => item.id))
      .toEqual(expect.arrayContaining([state.paymentOne.id, state.paymentTwo.id]));
    const branch = await api(`/branches/${state.branchId}`);
    expect(branch.payload.name).toBe(state.branchInput.name);
    const copied = await api(`/weekly-schedules/${state.destinationScheduleId}`);
    expect(copied.payload.classes[0].id).toBe(state.copiedClassId);
    const ownPayments = await api("/members/me/payments?page=1&limit=100", {
      token: state.memberToken,
    });
    expect(ownPayments.payload.items.some((item: any) =>
      item.receiptNumber === `${runId}-PAY-1`)).toBe(true);

    const persisted = await databasePool.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
         FROM public."user"
        WHERE email LIKE $1`,
      [`%${emailSuffix}%`],
    );
    expect(persisted.rows[0]!.count).toBeGreaterThanOrEqual(5);
  });
});
