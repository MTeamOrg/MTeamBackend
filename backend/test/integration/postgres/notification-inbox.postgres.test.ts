import { randomUUID } from "node:crypto";

import request from "supertest";

import { bearer, createFixtures, createIntegrationApp, database, untrustedBearer, type TestUser } from "./support/postgres-fixtures.js";

const fixtures = createFixtures();
const app = createIntegrationApp();

let clock = new Date("2036-03-01T15:00:00.000Z");
const clockApp = createIntegrationApp({ now: () => clock });

const DAY = 24 * 60 * 60 * 1000;

afterEach(async () => {
  await fixtures.cleanup();
});

afterAll(async () => {
  await database.$disconnect();
});

async function seed(userId: string, items: Array<{ title: string; createdAt: string; readAt?: string | null; id?: string }>) {
  await database.notification.createMany({
    data: items.map((item) => ({
      id: item.id ?? randomUUID(),
      userId,
      title: item.title,
      message: `Mensaje de ${item.title}`,
      type: "GENERAL" as const,
      createdAt: new Date(item.createdAt),
      readAt: item.readAt ? new Date(item.readAt) : null,
    })),
  });
}

describe("inbox security and isolation (real authentication and PostgreSQL)", () => {
  test("requires a valid token and an active account that already changed its temporary password", async () => {
    expect((await request(app).get("/api/notifications")).status).toBe(401);
    expect((await request(app).get("/api/notifications").set({ Authorization: "Bearer not-a-token" })).status).toBe(401);

    const inactive = await fixtures.user("MEMBER", { status: "INACTIVE" });
    const inactiveResponse = await request(app).get("/api/notifications").set(bearer(inactive));
    expect(inactiveResponse.status).toBe(403);
    expect(inactiveResponse.body.code).toBe("ACCOUNT_INACTIVE");

    const temporary = await fixtures.user("MEMBER", { isPasswordChangeRequired: true });
    const temporaryResponse = await request(app).get("/api/notifications").set(bearer(temporary));
    expect(temporaryResponse.status).toBe(403);
    expect(temporaryResponse.body.code).toBe("PASSWORD_CHANGE_REQUIRED");

    const deleted = { id: randomUUID(), role: "MEMBER" as const };
    expect((await request(app).get("/api/notifications").set(bearer(deleted))).status).toBe(401);
  });

  test("rejects tokens that are expired or signed with another secret", async () => {
    const member = await fixtures.user("MEMBER");
    for (const header of [
      untrustedBearer(member, { expiresInSeconds: -60 }),
      untrustedBearer(member, { secret: "another-secret-that-is-not-ours" }),
    ]) {
      const response = await request(app).get("/api/notifications").set(header);
      expect(response.status).toBe(401);
      expect(response.body.code).toBe("UNAUTHORIZED");
    }
    expect((await request(app).get("/api/notifications").set(bearer(member))).status).toBe(200);
  });

  test("shows every account only its own notifications, including administrators and trainers", async () => {
    const admin = await fixtures.user("ADMIN");
    const trainer = await fixtures.user("TRAINER");
    const memberA = await fixtures.user("MEMBER");
    const memberB = await fixtures.user("MEMBER");
    await seed(memberA.id, [{ title: "A1", createdAt: "2030-01-01T10:00:00Z" }, { title: "A2", createdAt: "2030-01-02T10:00:00Z" }]);
    await seed(memberB.id, [{ title: "B1", createdAt: "2030-01-03T10:00:00Z" }]);
    await seed(trainer.id, [{ title: "T1", createdAt: "2030-01-04T10:00:00Z" }]);

    const titlesFor = async (user: TestUser) => {
      const response = await request(app).get("/api/notifications").set(bearer(user));
      expect(response.status).toBe(200);
      return (response.body.items as Array<{ title: string; userId: string }>).map((item) => {
        expect(item.userId).toBe(user.id);
        return item.title;
      });
    };
    // Members also receive the derived "Cuota vencida" notice, which is not part of what this test seeds.
    const ownTitles = async (user: TestUser) => (await titlesFor(user)).filter((title) => title !== "Cuota vencida").sort();
    expect(await ownTitles(memberA)).toEqual(["A1", "A2"]);
    expect(await ownTitles(memberB)).toEqual(["B1"]);
    expect(await titlesFor(trainer)).toEqual(["T1"]);
    expect(await titlesFor(admin)).toEqual([]);
  });

  test("answers the same 404 for another user's notification and for one that does not exist", async () => {
    const owner = await fixtures.user("MEMBER");
    const intruder = await fixtures.user("MEMBER");
    const foreignId = randomUUID();
    await seed(owner.id, [{ id: foreignId, title: "Privada", createdAt: "2030-01-01T10:00:00Z" }]);

    const foreign = await request(app).get(`/api/notifications/${foreignId}`).set(bearer(intruder));
    const missing = await request(app).get(`/api/notifications/${randomUUID()}`).set(bearer(intruder));
    expect(foreign.status).toBe(404);
    expect(foreign.body).toEqual(missing.body);
    expect(JSON.stringify(foreign.body)).not.toContain("Privada");

    expect((await request(app).get(`/api/notifications/${foreignId}`).set(bearer(owner))).status).toBe(200);
    expect((await request(app).get("/api/notifications/not-a-uuid").set(bearer(owner))).status).toBe(400);
  });

  test("answers the same 404 to administrators and trainers asking for a member's private notification", async () => {
    const owner = await fixtures.user("MEMBER");
    const privateId = randomUUID();
    await seed(owner.id, [{ id: privateId, title: "Privada", createdAt: "2030-01-01T10:00:00Z" }]);

    for (const role of ["ADMIN", "TRAINER"] as const) {
      const visitor = await fixtures.user(role);
      const foreign = await request(app).get(`/api/notifications/${privateId}`).set(bearer(visitor));
      const missing = await request(app).get(`/api/notifications/${randomUUID()}`).set(bearer(visitor));
      expect({ role, status: foreign.status, body: foreign.body }).toEqual({ role, status: 404, body: missing.body });
      expect((await request(app).patch(`/api/notifications/${privateId}/read-status`).set(bearer(visitor))).status).toBe(404);
      expect((await request(app).patch(`/api/notifications/${randomUUID()}/read-status`).set(bearer(visitor))).status).toBe(404);
      expect((await request(app).get("/api/notifications").set(bearer(visitor))).body.items.some(({ id }: { id: string }) => id === privateId)).toBe(false);
    }
    expect((await database.notification.findUniqueOrThrow({ where: { id: privateId } })).readAt).toBeNull();
  });

  test("never lets one user mark another user's notifications as read", async () => {
    const owner = await fixtures.user("MEMBER");
    const intruder = await fixtures.user("MEMBER");
    const foreignId = randomUUID();
    await seed(owner.id, [{ id: foreignId, title: "Privada", createdAt: "2030-01-01T10:00:00Z" }]);
    await seed(intruder.id, [{ title: "Propia", createdAt: "2030-01-02T10:00:00Z" }]);

    expect((await request(app).patch(`/api/notifications/${foreignId}/read-status`).set(bearer(intruder))).status).toBe(404);
    expect((await database.notification.findUniqueOrThrow({ where: { id: foreignId } })).readAt).toBeNull();

    expect((await request(app).patch("/api/notifications/read-status").set(bearer(intruder))).status).toBe(204);
    expect((await database.notification.findUniqueOrThrow({ where: { id: foreignId } })).readAt).toBeNull();
    expect(await database.notification.count({ where: { userId: intruder.id, readAt: null } })).toBe(0);
  });

  test("ignores any user identity supplied by the client", async () => {
    const owner = await fixtures.user("MEMBER");
    const intruder = await fixtures.user("MEMBER");
    await seed(owner.id, [{ title: "Privada", createdAt: "2030-01-01T10:00:00Z" }]);

    const byQuery = await request(app).get(`/api/notifications?userId=${owner.id}`).set(bearer(intruder));
    expect(byQuery.status).toBe(400);
    const byBody = await request(app).patch("/api/notifications/read-status").set(bearer(intruder)).send({ userId: owner.id });
    expect(byBody.status).toBe(204);
    expect(await database.notification.count({ where: { userId: owner.id, readAt: null } })).toBe(1);
  });
});

describe("inbox contract (pagination, ordering, unread counter and history)", () => {
  test("orders newest first with a stable tie breaker and walks every page exactly once", async () => {
    const member = await fixtures.user("TRAINER");
    const sameInstant = "2030-05-05T10:00:00.000Z";
    await seed(member.id, [
      { title: "N1", createdAt: "2030-05-01T10:00:00.000Z" },
      { title: "N2", createdAt: "2030-05-02T10:00:00.000Z" },
      { title: "N3", createdAt: sameInstant },
      { title: "N4", createdAt: sameInstant },
      { title: "N5", createdAt: "2030-05-06T10:00:00.000Z" },
    ]);

    const collected: string[] = [];
    for (let page = 1; page <= 3; page += 1) {
      const response = await request(app).get(`/api/notifications?page=${page}&limit=2`).set(bearer(member));
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ page, limit: 2, total: 5 });
      collected.push(...response.body.items.map((item: { id: string }) => item.id));
    }
    expect(new Set(collected).size).toBe(5);

    const all = await request(app).get("/api/notifications?limit=10").set(bearer(member));
    expect(all.headers["cache-control"]).toBe("private, no-store");
    const dates = all.body.items.map((item: { createdAt: string }) => item.createdAt);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(all.body.items.map((item: { id: string }) => item.id)).toEqual(collected);
  });

  test("reports the global unread counter whatever the filter or the page", async () => {
    const member = await fixtures.user("TRAINER");
    await seed(member.id, [
      { title: "Leída 1", createdAt: "2030-05-01T10:00:00Z", readAt: "2030-05-01T11:00:00Z" },
      { title: "Leída 2", createdAt: "2030-05-02T10:00:00Z", readAt: "2030-05-02T11:00:00Z" },
      { title: "Nueva 1", createdAt: "2030-05-03T10:00:00Z" },
      { title: "Nueva 2", createdAt: "2030-05-04T10:00:00Z" },
      { title: "Nueva 3", createdAt: "2030-05-05T10:00:00Z" },
    ]);

    const everything = await request(app).get("/api/notifications?limit=1").set(bearer(member));
    expect(everything.body).toMatchObject({ total: 5, unreadCount: 3 });
    const readOnly = await request(app).get("/api/notifications?isRead=true&limit=1&page=2").set(bearer(member));
    expect(readOnly.body).toMatchObject({ total: 2, unreadCount: 3 });
    const unreadOnly = await request(app).get("/api/notifications?isRead=false").set(bearer(member));
    expect(unreadOnly.body).toMatchObject({ total: 3, unreadCount: 3 });

    const other = await fixtures.user("TRAINER");
    expect((await request(app).get("/api/notifications").set(bearer(other))).body).toMatchObject({ total: 0, unreadCount: 0 });
  });

  test("marks as read without deleting history or rewriting the first read date", async () => {
    const member = await fixtures.user("TRAINER");
    const id = randomUUID();
    await seed(member.id, [{ id, title: "Una", createdAt: "2030-05-01T10:00:00Z" }, { title: "Dos", createdAt: "2030-05-02T10:00:00Z" }]);

    expect((await request(app).patch(`/api/notifications/${id}/read-status`).set(bearer(member))).status).toBe(204);
    const firstRead = (await database.notification.findUniqueOrThrow({ where: { id } })).readAt;
    expect(firstRead).toBeInstanceOf(Date);
    expect((await request(app).patch(`/api/notifications/${id}/read-status`).set(bearer(member))).status).toBe(204);
    expect((await database.notification.findUniqueOrThrow({ where: { id } })).readAt).toEqual(firstRead);

    expect((await request(app).patch("/api/notifications/read-status").set(bearer(member))).status).toBe(204);
    const history = await request(app).get("/api/notifications").set(bearer(member));
    expect(history.body).toMatchObject({ total: 2, unreadCount: 0 });
    expect(history.body.items.every((item: { readAt: string | null }) => item.readAt !== null)).toBe(true);
    expect(history.body.items[0]).toEqual({
      id: expect.any(String),
      userId: member.id,
      title: "Dos",
      message: "Mensaje de Dos",
      type: "GENERAL",
      createdAt: "2030-05-02T10:00:00.000Z",
      readAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/),
    });
  });

  test("rejects invalid pagination and filters but tolerates a page beyond the last one", async () => {
    const member = await fixtures.user("TRAINER");
    await seed(member.id, [{ title: "Única", createdAt: "2030-05-01T10:00:00Z" }]);
    for (const query of ["page=0", "page=-1", "page=abc", "limit=0", "limit=101", "limit=2.5", "isRead=maybe", "isRead=true&isRead=false", "order=asc"]) {
      const response = await request(app).get(`/api/notifications?${query}`).set(bearer(member));
      expect({ query, status: response.status, code: response.body.code }).toEqual({ query, status: 400, code: "VALIDATION_ERROR" });
    }

    const beyond = await request(app).get("/api/notifications?page=5&limit=20").set(bearer(member));
    expect(beyond.status).toBe(200);
    expect(beyond.body).toMatchObject({ items: [], page: 5, total: 1, unreadCount: 1 });

    for (const page of ["2147483647", "9007199254740991", "99999999999999999999", "1e30"]) {
      const absurd = await request(app).get(`/api/notifications?page=${page}&limit=100`).set(bearer(member));
      expect({ page, status: absurd.status < 500 ? "handled" : absurd.status }).toEqual({ page, status: "handled" });
    }
  });
});

describe("membership fee notices generated when the member opens the inbox", () => {
  async function member() {
    const admin = await fixtures.user("ADMIN");
    return { admin, member: await fixtures.user("MEMBER") };
  }

  async function open(user: TestUser, now: Date) {
    clock = now;
    const response = await request(clockApp).get("/api/notifications?limit=100").set(bearer(user));
    expect(response.status).toBe(200);
    return response.body as { items: Array<{ type: string; title: string; message: string }>; unreadCount: number };
  }

  const feeNotices = <T extends { type: string }>(body: { items: T[] }) =>
    body.items.filter(({ type }) => type === "MEMBERSHIP_EXPIRED" || type === "MEMBERSHIP_EXPIRING");

  test("a member who never paid gets exactly one expired notice, even with repeated and concurrent openings", async () => {
    const { member: user } = await member();
    const now = new Date("2036-03-01T15:00:00.000Z");

    const first = await open(user, now);
    expect(feeNotices(first)).toEqual([
      expect.objectContaining({
        type: "MEMBERSHIP_EXPIRED",
        title: "Cuota vencida",
        message: "Tu cuota se encuentra vencida. Registrá un nuevo pago para mantener tu acceso.",
      }),
    ]);
    await open(user, now);
    clock = now;
    const openings = await Promise.all(Array.from({ length: 10 }, () => request(clockApp).get("/api/notifications").set(bearer(user))));
    expect(openings.every(({ status }) => status === 200)).toBe(true);
    expect(await database.notification.count({ where: { userId: user.id } })).toBe(1);
  });

  test("warns five days or less before expiry and shows the expiry in Buenos Aires time", async () => {
    const { admin, member: user } = await member();
    const now = new Date("2036-03-01T15:00:00.000Z");
    // 02:30Z on the 5th is 23:30 on the 4th in Buenos Aires.
    await fixtures.accreditedPayment(user.id, admin.id, "2036-02-04T02:30:00.000Z", "2036-03-05T02:30:00.000Z");

    const body = await open(user, now);
    expect(feeNotices(body)).toEqual([
      expect.objectContaining({
        type: "MEMBERSHIP_EXPIRING",
        title: "Cuota próxima a vencer",
        message: "Tu cuota vence el 04/03/2036 a las 23:30.",
      }),
    ]);
    await open(user, new Date(now.getTime() + 60 * 60 * 1000));
    expect(await database.notification.count({ where: { userId: user.id } })).toBe(1);
  });

  test.each([
    ["exactly five days left", 5 * DAY, "MEMBERSHIP_EXPIRING"],
    ["five days and one millisecond left", 5 * DAY + 1, null],
    ["one millisecond left", 1, "MEMBERSHIP_EXPIRING"],
    ["expiring at this very instant", 0, "MEMBERSHIP_EXPIRED"],
    ["expired one millisecond ago", -1, "MEMBERSHIP_EXPIRED"],
  ] as const)("classifies a fee with %s", async (_label, remaining, expectedType) => {
    const { admin, member: user } = await member();
    const now = new Date("2036-03-01T15:00:00.000Z");
    const expiry = new Date(now.getTime() + remaining);
    // The database enforces expires_at = accredited_at + 30 days.
    await fixtures.accreditedPayment(user.id, admin.id, new Date(expiry.getTime() - 30 * DAY).toISOString(), expiry.toISOString());

    const body = await open(user, now);
    expect(feeNotices(body).map(({ type }) => type)).toEqual(expectedType ? [expectedType] : []);
  });

  test.each([
    ["crossing midnight", "2036-03-02T02:59:00.000Z", "01/03/2036 a las 23:59"],
    ["the first minute of a day", "2036-03-02T03:00:00.000Z", "02/03/2036 a las 00:00"],
    ["crossing a month", "2036-04-01T02:30:00.000Z", "31/03/2036 a las 23:30"],
    ["crossing a year", "2037-01-01T02:59:00.000Z", "31/12/2036 a las 23:59"],
    ["crossing a leap day", "2036-03-01T02:30:00.000Z", "29/02/2036 a las 23:30"],
  ])("states the expiry correctly when %s", async (_label, expiresAt, expectedDate) => {
    const { admin, member: user } = await member();
    const expiry = new Date(expiresAt);
    await fixtures.accreditedPayment(user.id, admin.id, new Date(expiry.getTime() - 30 * DAY).toISOString(), expiry.toISOString());

    const body = await open(user, new Date(expiry.getTime() - 2 * DAY));
    expect(feeNotices(body)[0]?.message).toBe(`Tu cuota vence el ${expectedDate}.`);
  });

  test("reports the expiry date once the fee has expired and keeps history after a renewal", async () => {
    const { admin, member: user } = await member();
    await fixtures.accreditedPayment(user.id, admin.id, "2036-02-01T15:00:00.000Z", "2036-03-02T15:00:00.000Z");

    const expired = await open(user, new Date("2036-03-10T12:00:00.000Z"));
    expect(feeNotices(expired)).toEqual([
      expect.objectContaining({
        type: "MEMBERSHIP_EXPIRED",
        message: "Tu cuota venció el 02/03/2036 a las 12:00. Registrá un nuevo pago para mantener tu acceso.",
      }),
    ]);

    await fixtures.accreditedPayment(user.id, admin.id, "2036-03-10T13:00:00.000Z", "2036-04-09T13:00:00.000Z");
    const renewed = await open(user, new Date("2036-03-11T12:00:00.000Z"));
    expect(feeNotices(renewed)).toHaveLength(1);
    expect(renewed.unreadCount).toBe(1);

    const nextCycle = await open(user, new Date("2036-04-06T12:00:00.000Z"));
    expect(feeNotices(nextCycle).map(({ type }) => type).sort()).toEqual(["MEMBERSHIP_EXPIRED", "MEMBERSHIP_EXPIRING"]);
  });

  test("uses the latest accredited payment, which replaces rather than accumulates the previous validity", async () => {
    const { admin, member: user } = await member();
    await fixtures.accreditedPayment(user.id, admin.id, "2036-02-01T15:00:00.000Z", "2036-03-02T15:00:00.000Z");
    await fixtures.accreditedPayment(user.id, admin.id, "2036-02-28T15:00:00.000Z", "2036-03-29T15:00:00.000Z");
    expect(feeNotices(await open(user, new Date("2036-03-01T15:00:00.000Z")))).toHaveLength(0);
  });

  test("accrediting a payment through the API renews the validity without creating or repeating notices, even if it is voided", async () => {
    const { admin, member: user } = await member();
    const realNow = new Date();

    // Never paid: the fee is expired and the member is told once.
    expect(feeNotices(await open(user, realNow)).map(({ type }) => type)).toEqual(["MEMBERSHIP_EXPIRED"]);

    const accredited = await request(clockApp).post("/api/payments").set(bearer(admin)).send({ memberId: user.id, amount: 20000, method: "CASH" });
    expect(accredited.status).toBe(201);
    const expiresAt = new Date(accredited.body.expiresAt as string);
    expect(expiresAt.getTime() - new Date(accredited.body.accreditedAt as string).getTime()).toBe(30 * DAY);

    // Now the fee is current: nothing new, and the earlier notice stays in the history.
    const renewed = await open(user, new Date(realNow.getTime() + 60_000));
    expect(feeNotices(renewed).map(({ type }) => type)).toEqual(["MEMBERSHIP_EXPIRED"]);

    // Six days before it expires there is still nothing; five days before, exactly one notice.
    expect(feeNotices(await open(user, new Date(expiresAt.getTime() - 5 * DAY - 1))).map(({ type }) => type)).toEqual(["MEMBERSHIP_EXPIRED"]);
    const warned = await open(user, new Date(expiresAt.getTime() - 5 * DAY));
    expect(feeNotices(warned).map(({ type }) => type).sort()).toEqual(["MEMBERSHIP_EXPIRED", "MEMBERSHIP_EXPIRING"]);
    await open(user, new Date(expiresAt.getTime() - 4 * DAY));
    expect(await database.notification.count({ where: { userId: user.id } })).toBe(2);

    // Voiding the only payment brings back the "never paid" state, which was already announced.
    const voided = await request(clockApp).post(`/api/payments/${accredited.body.id}/voids`).set(bearer(admin)).send({ reason: "Pago cargado por error" });
    expect(voided.status).toBe(200);
    await open(user, new Date(expiresAt.getTime() - 4 * DAY));
    expect(await database.notification.count({ where: { userId: user.id } })).toBe(2);
  });

  test("never creates fee notices for trainers or administrators", async () => {
    const trainer = await fixtures.user("TRAINER");
    const admin = await fixtures.user("ADMIN");
    for (const account of [trainer, admin]) {
      expect(feeNotices(await open(account, new Date("2036-03-01T15:00:00.000Z")))).toHaveLength(0);
    }
    expect(await database.notification.count({ where: { userId: { in: [trainer.id, admin.id] } } })).toBe(0);
  });
});
