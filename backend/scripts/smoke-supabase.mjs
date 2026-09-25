import { resolve } from "node:path";

import { config } from "dotenv";
import { z } from "zod";

config({
  path: [
    resolve(process.cwd(), ".env.smoke.local"),
    resolve(process.cwd(), ".env.bootstrap.local"),
  ],
  override: false,
  quiet: true,
});

const smokeEnvironmentSchema = z.object({
  SMOKE_API_URL: z.url().default("http://localhost:3000/api"),
  SMOKE_MEMBER_INITIAL_PASSWORD: z.string().min(12).max(72),
  SMOKE_MEMBER_PASSWORD: z.string().min(12).max(72),
  SMOKE_TRAINER_PASSWORD: z.string().min(12).max(72),
  BOOTSTRAP_ADMIN_EMAIL: z.string().trim().toLowerCase().pipe(z.email()),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12).max(72),
});

const validation = smokeEnvironmentSchema.safeParse(process.env);
if (!validation.success) {
  const fields = [
    ...new Set(
      validation.error.issues.map((issue) => String(issue.path[0] ?? "unknown")),
    ),
  ].sort();
  console.error(`Invalid or missing local smoke variables: ${fields.join(", ")}`);
  process.exit(1);
}

const environment = validation.data;
const apiBaseUrl = environment.SMOKE_API_URL.replace(/\/$/, "");
const verifyOnly = process.env.SMOKE_VERIFY_ONLY === "true";
const marker = "TEST-SUPABASE-SMOKE-20260925";

const member = {
  firstName: "TEST SUPABASE",
  lastName: "SMOKE MEMBER",
  documentNumber: "990000001",
  birthDate: "1990-01-01",
  email: "mteam.supabase.smoke.member@example.com",
  phone: "+54 11 5555-0001",
  emergencyContactName: "TEST SUPABASE CONTACT",
  emergencyContactPhone: "+54 11 5555-0091",
};
const trainer = {
  firstName: "TEST SUPABASE",
  lastName: "SMOKE TRAINER",
  documentNumber: "990000002",
  birthDate: "1985-01-01",
  email: "mteam.supabase.smoke.trainer@example.com",
  phone: "+54 11 5555-0002",
  role: "TRAINER",
  specialty: marker,
  description: `${marker} - generated integration data`,
};
const branchInput = {
  name: `${marker} - BRANCH`,
  address: `${marker} 1000, Buenos Aires`,
  openingHours: "TEST DATA - Monday to Friday 08:00-20:00",
  phone: "+54 11 5555-0003",
  description: `${marker} - generated integration data`,
  imageUrl: "https://example.com/mteam-supabase-smoke.jpg",
};
const priceInput = {
  amount: 12345.67,
  effectiveFrom: "2026-01-01T00:00:00.000Z",
};
const scheduleInput = {
  weekStartsOn: "2030-09-02",
  activity: `${marker} - CLASS`,
  startsAt: "2030-09-03T18:00:00-03:00",
};

async function request(path, { method = "GET", token, body, expected = [200] } = {}) {
  const headers = { accept: "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const responseText = await response.text();
  let payload = null;
  if (responseText) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = responseText;
    }
  }
  if (!expected.includes(response.status)) {
    throw new Error(`${method} ${path} returned unexpected status ${response.status}`);
  }
  return { status: response.status, payload };
}

async function login(email, password, expected = [200]) {
  return request("/auth/login", {
    method: "POST",
    body: { email, password },
    expected,
  });
}

function oneOrNone(items, predicate, label) {
  const matches = items.filter(predicate);
  if (matches.length > 1) throw new Error(`Duplicate ${label} smoke records found`);
  return matches[0] ?? null;
}

const summary = {
  mode: verifyOnly ? "persistence-verification" : "create-or-reuse",
  marker,
};

try {
  await request("/health");
  await request(`/branches?search=${encodeURIComponent(marker)}`);
  summary.healthAndDatabaseQuery = "ok";

  const adminLogin = await login(
    environment.BOOTSTRAP_ADMIN_EMAIL,
    environment.BOOTSTRAP_ADMIN_PASSWORD,
  );
  const adminToken = adminLogin.payload.accessToken;
  summary.adminLogin = "ok";

  await request("/users", { expected: [401] });

  let memberLogin = await login(member.email, environment.SMOKE_MEMBER_PASSWORD, [200, 401]);
  let memberCreated = false;
  if (memberLogin.status === 401) {
    const initialLogin = await login(
      member.email,
      environment.SMOKE_MEMBER_INITIAL_PASSWORD,
      [200, 401],
    );
    if (initialLogin.status === 401) {
      if (verifyOnly) throw new Error("Persisted smoke member was not found");
      await request("/auth/register", {
        method: "POST",
        body: {
          ...member,
          password: environment.SMOKE_MEMBER_INITIAL_PASSWORD,
        },
        expected: [201],
      });
      memberCreated = true;
      memberLogin = await login(
        member.email,
        environment.SMOKE_MEMBER_INITIAL_PASSWORD,
      );
    } else {
      memberLogin = initialLogin;
    }

    if (memberLogin.payload.user.isPasswordChangeRequired) {
      if (verifyOnly) throw new Error("Persisted smoke member still requires a password change");
      await request("/members/me/payments", {
        token: memberLogin.payload.accessToken,
        expected: [403],
      });
      await request("/auth/password", {
        method: "PATCH",
        token: memberLogin.payload.accessToken,
        body: {
          currentPassword: environment.SMOKE_MEMBER_INITIAL_PASSWORD,
          newPassword: environment.SMOKE_MEMBER_PASSWORD,
        },
        expected: [204],
      });
      memberLogin = await login(member.email, environment.SMOKE_MEMBER_PASSWORD);
    }
  }

  const memberToken = memberLogin.payload.accessToken;
  const memberId = memberLogin.payload.user.id;
  await request("/users", { token: memberToken, expected: [403] });
  await request("/members/me/payments", { token: memberToken });
  summary.memberRegistration = memberCreated ? "created" : "reused";
  summary.memberLoginAndPermissions = "ok";

  const userSearch = await request(
    `/users?search=${encodeURIComponent(trainer.email)}&page=1&limit=100`,
    { token: adminToken },
  );
  let trainerRecord = oneOrNone(
    userSearch.payload.items,
    (item) => item.email === trainer.email,
    "trainer",
  );
  if (!trainerRecord) {
    if (verifyOnly) throw new Error("Persisted smoke trainer was not found");
    const createdTrainer = await request("/users", {
      method: "POST",
      token: adminToken,
      body: { ...trainer, password: environment.SMOKE_TRAINER_PASSWORD },
      expected: [201],
    });
    trainerRecord = createdTrainer.payload;
    summary.trainer = "created";
  } else {
    summary.trainer = "reused";
  }

  const priceHistory = await request("/membership-prices?page=1&limit=100", {
    token: adminToken,
  });
  let price = oneOrNone(
    priceHistory.payload.items,
    (item) =>
      item.amount === priceInput.amount.toFixed(2) &&
      item.effectiveFrom === priceInput.effectiveFrom,
    "membership price",
  );
  if (!price) {
    if (verifyOnly) throw new Error("Persisted smoke membership price was not found");
    price = (
      await request("/membership-prices", {
        method: "POST",
        token: adminToken,
        body: priceInput,
        expected: [201],
      })
    ).payload;
    summary.membershipPrice = "created";
  } else {
    summary.membershipPrice = "reused";
  }
  await request("/membership-prices/current", { token: memberToken });

  const paymentHistory = await request(
    `/payments?memberId=${encodeURIComponent(memberId)}&page=1&limit=100`,
    { token: adminToken },
  );
  let payment = oneOrNone(
    paymentHistory.payload.items,
    (item) => item.receiptNumber === marker,
    "payment",
  );
  if (!payment) {
    if (verifyOnly) throw new Error("Persisted smoke payment was not found");
    payment = (
      await request("/payments", {
        method: "POST",
        token: adminToken,
        body: {
          memberId,
          amount: priceInput.amount,
          method: "TEST",
          receiptNumber: marker,
        },
        expected: [201],
      })
    ).payload;
    summary.paymentAccreditation = "created";
  } else {
    summary.paymentAccreditation = "reused";
  }
  if (payment.status === "ACCREDITED") {
    if (verifyOnly) throw new Error("Persisted smoke payment was not voided");
    payment = (
      await request(`/payments/${payment.id}/voids`, {
        method: "POST",
        token: adminToken,
        body: { reason: `${marker} - intentional verification void` },
      })
    ).payload;
    summary.paymentVoid = "voided";
  } else if (payment.status === "VOIDED") {
    summary.paymentVoid = "already-voided";
  } else {
    throw new Error(`Unexpected smoke payment status: ${payment.status}`);
  }
  const ownPayments = await request("/members/me/payments?page=1&limit=100", {
    token: memberToken,
  });
  if (!ownPayments.payload.items.some((item) => item.receiptNumber === marker)) {
    throw new Error("Smoke payment is missing from member history");
  }

  const branchHistory = await request(
    `/admin/branches?search=${encodeURIComponent(branchInput.name)}&page=1&limit=100`,
    { token: adminToken },
  );
  let branch = oneOrNone(
    branchHistory.payload.items,
    (item) => item.name === branchInput.name && item.address === branchInput.address,
    "branch",
  );
  if (!branch) {
    if (verifyOnly) throw new Error("Persisted smoke branch was not found");
    branch = (
      await request("/branches", {
        method: "POST",
        token: adminToken,
        body: branchInput,
        expected: [201],
      })
    ).payload;
    summary.branch = "created";
  } else {
    summary.branch = "reused";
  }
  await request(`/branches/${branch.id}`);

  const weeklySchedule = await request(
    `/weekly-schedules?weekStartsOn=${scheduleInput.weekStartsOn}`,
  );
  let scheduledClass = oneOrNone(
    weeklySchedule.payload.classes,
    (item) => item.activity === scheduleInput.activity,
    "scheduled class",
  );
  if (!scheduledClass) {
    if (verifyOnly) throw new Error("Persisted smoke class was not found");
    scheduledClass = (
      await request("/scheduled-classes", {
        method: "POST",
        token: adminToken,
        body: {
          ...scheduleInput,
          branchId: branch.id,
          trainerId: trainerRecord.id,
        },
        expected: [201],
      })
    ).payload;
    summary.scheduledClass = "created";
  } else {
    summary.scheduledClass = "reused";
  }

  summary.persistence = verifyOnly ? "confirmed" : "pending-restart-check";
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Supabase smoke verification failed");
  process.exitCode = 1;
}
