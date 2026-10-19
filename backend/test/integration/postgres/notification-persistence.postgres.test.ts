import request from "supertest";

import { NotificationRepository } from "../../../src/repository/notification-repository.js";
import { bearer, createDatabaseClient, createFixtures, createIntegrationApp, database } from "./support/postgres-fixtures.js";

const fixtures = createFixtures();
const app = createIntegrationApp();

afterEach(async () => {
  await fixtures.cleanup();
});

afterAll(async () => {
  await database.$disconnect();
});

interface StoredRow {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  dedupe_key: string | null;
  created_at: Date;
  read_at: Date | null;
}

async function storedRowsOf(userId: string): Promise<StoredRow[]> {
  return database.$queryRaw<StoredRow[]>`
    SELECT id, user_id, title, message, type, dedupe_key, created_at, read_at
    FROM notification WHERE user_id = ${userId}::uuid ORDER BY created_at, id`;
}

describe("a notification travels through every layer and survives a restart (real PostgreSQL)", () => {
  test("is created by a business event, stored, read, marked as read, kept after a restart and hidden from others", async () => {
    const admin = await fixtures.user("ADMIN");
    const owner = await fixtures.user("MEMBER");
    const other = await fixtures.user("MEMBER");
    const certificate = await fixtures.pendingCertificate(owner.id);
    // A current fee, so that opening the inbox derives no fee notice and only the certificate notice exists.
    const accreditedAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await fixtures.accreditedPayment(owner.id, admin.id, accreditedAt.toISOString(), new Date(accreditedAt.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString());

    // 1-2. A real business event creates the notification and PostgreSQL stores it, unread.
    const review = await request(app).patch(`/api/medical-certificates/${certificate.id}/review`).set(bearer(admin))
      .send({ status: "REJECTED", reviewComment: "Falta la firma del profesional." });
    expect(review.status).toBe(200);
    const [stored] = await storedRowsOf(owner.id);
    expect(await storedRowsOf(owner.id)).toHaveLength(1);
    expect(stored).toMatchObject({
      user_id: owner.id,
      title: "Apto médico rechazado",
      message: "Tu apto médico fue rechazado. Observación: Falta la firma del profesional.",
      type: "MEDICAL_CERTIFICATE_REVIEWED",
      dedupe_key: `medical-certificate-reviewed:${certificate.id}:REJECTED`,
      read_at: null,
    });

    // 3. The repository finds it.
    const fromRepository = await new NotificationRepository(database).findOwn(stored!.id, owner.id);
    expect(fromRepository).toMatchObject({ id: stored!.id, title: "Apto médico rechazado", readAt: null });

    // 4. The API returns it, both in the list and by id.
    const fromApi = await request(app).get(`/api/notifications/${stored!.id}`).set(bearer(owner));
    expect(fromApi.status).toBe(200);
    expect(fromApi.body).toMatchObject({ id: stored!.id, userId: owner.id, readAt: null, createdAt: stored!.created_at.toISOString() });
    expect((await request(app).get("/api/notifications").set(bearer(owner))).body.items.map(({ id }: { id: string }) => id)).toContain(stored!.id);

    // 5-6. Marking it as read changes read_at in the database.
    expect((await request(app).patch(`/api/notifications/${stored!.id}/read-status`).set(bearer(owner))).status).toBe(204);
    const [afterReading] = await storedRowsOf(owner.id);
    expect(afterReading!.read_at).toBeInstanceOf(Date);
    expect(afterReading!.read_at!.getTime()).toBeGreaterThanOrEqual(afterReading!.created_at.getTime());

    // 7-8. It is still there and still read.
    const again = await request(app).get(`/api/notifications/${stored!.id}`).set(bearer(owner));
    expect(again.body.readAt).toBe(afterReading!.read_at!.toISOString());
    expect((await request(app).get("/api/notifications").set(bearer(owner))).body).toMatchObject({ total: expect.any(Number), unreadCount: 0 });

    // 9. "Restart": a new connection pool and a new application instance see the same state.
    const restarted = createDatabaseClient();
    try {
      const restartedApp = createIntegrationApp({ database: restarted });
      const afterRestart = await request(restartedApp).get(`/api/notifications/${stored!.id}`).set(bearer(owner));
      expect(afterRestart.status).toBe(200);
      expect(afterRestart.body).toMatchObject({ id: stored!.id, readAt: afterReading!.read_at!.toISOString() });
      expect(await restarted.notification.count({ where: { userId: owner.id } })).toBe(1);

      // 10. Another user still cannot reach it, before or after the restart.
      for (const target of [app, restartedApp]) {
        expect((await request(target).get(`/api/notifications/${stored!.id}`).set(bearer(other))).status).toBe(404);
        expect((await request(target).patch(`/api/notifications/${stored!.id}/read-status`).set(bearer(other))).status).toBe(404);
        expect((await request(target).get("/api/notifications").set(bearer(other))).body.items.some(({ id }: { id: string }) => id === stored!.id)).toBe(false);
      }
    } finally {
      await restarted.$disconnect();
    }
    expect((await storedRowsOf(owner.id))[0]!.read_at).toEqual(afterReading!.read_at);
  });

  test("concurrent single and bulk reads leave a consistent state and keep the first read date", async () => {
    const owner = await fixtures.user("TRAINER");
    const base = Date.parse("2030-06-01T12:00:00.000Z");
    await database.notification.createMany({
      data: Array.from({ length: 30 }, (_, index) => ({
        userId: owner.id, title: `Aviso ${index}`, message: "Mensaje", type: "GENERAL" as const, createdAt: new Date(base + index * 60_000),
      })),
    });
    const ids = (await storedRowsOf(owner.id)).map(({ id }) => id);

    const responses = await Promise.all([
      ...ids.slice(0, 10).map((id) => request(app).patch(`/api/notifications/${id}/read-status`).set(bearer(owner))),
      ...Array.from({ length: 5 }, () => request(app).patch("/api/notifications/read-status").set(bearer(owner))),
      ...Array.from({ length: 5 }, () => request(app).get("/api/notifications?limit=100").set(bearer(owner))),
    ]);
    expect(responses.map(({ status }) => status).filter((status) => status >= 300)).toEqual([]);

    const settled = await storedRowsOf(owner.id);
    expect(settled).toHaveLength(30);
    expect(settled.every(({ read_at }) => read_at instanceof Date)).toBe(true);

    // Reading again never rewrites a date that was already stored.
    expect((await request(app).patch("/api/notifications/read-status").set(bearer(owner))).status).toBe(204);
    expect((await storedRowsOf(owner.id)).map(({ read_at }) => read_at!.getTime())).toEqual(settled.map(({ read_at }) => read_at!.getTime()));
    expect((await request(app).get("/api/notifications").set(bearer(owner))).body).toMatchObject({ total: 30, unreadCount: 0 });
  });

  test("marking everything as read updates every unread notice of the user, on any page, and nobody else's", async () => {
    const owner = await fixtures.user("TRAINER");
    const other = await fixtures.user("TRAINER");
    const base = Date.parse("2030-06-01T12:00:00.000Z");
    const rows = (userId: string, count: number) => Array.from({ length: count }, (_, index) => ({
      userId,
      title: `Aviso ${index}`,
      message: "Mensaje",
      type: "GENERAL" as const,
      createdAt: new Date(base + index * 60_000),
    }));
    await database.notification.createMany({ data: [...rows(owner.id, 45), ...rows(other.id, 3)] });

    const firstPage = await request(app).get("/api/notifications?page=1&limit=20").set(bearer(owner));
    expect(firstPage.body).toMatchObject({ total: 45, unreadCount: 45 });
    expect(firstPage.body.items).toHaveLength(20);

    expect((await request(app).patch("/api/notifications/read-status").set(bearer(owner))).status).toBe(204);

    const unreadOf = async (userId: string) => {
      const [row] = await database.$queryRaw<Array<{ unread: bigint }>>`
        SELECT count(*) AS unread FROM notification WHERE user_id = ${userId}::uuid AND read_at IS NULL`;
      return Number(row?.unread);
    };
    expect(await unreadOf(owner.id)).toBe(0);
    expect(await unreadOf(other.id)).toBe(3);
    expect((await request(app).get("/api/notifications?limit=100").set(bearer(owner))).body).toMatchObject({ total: 45, unreadCount: 0 });
  });
});
