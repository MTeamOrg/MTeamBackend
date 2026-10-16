import { randomUUID } from "node:crypto";

import request from "supertest";

import { bearer, createDatabaseClient, createFixtures, createIntegrationApp, database } from "./support/postgres-fixtures.js";

/**
 * Simultaneous administrative operations and simultaneous openings of the inbox (REN-03): whatever the
 * interleaving, each real event produces its notices exactly once and no notice is lost or duplicated.
 */
const fixtures = createFixtures();
const app = createIntegrationApp();

const WEEK = "2036-03-03";
const NEXT_WEEK = "2036-03-10";
const CLASS_AT = "2036-03-04T13:00:00.000Z";
const DAY = 24 * 60 * 60 * 1000;

function noticesOf(userId: string) {
  return database.notification.findMany({
    where: { userId },
    select: { title: true, message: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

const titlesOf = async (userId: string) => (await noticesOf(userId)).map(({ title }) => title).sort();

afterEach(async () => {
  await fixtures.cleanup();
});

afterAll(async () => {
  await database.$disconnect();
});

describe("simultaneous administrative operations", () => {
  test("five simultaneous copies of a week create it once, leave the source untouched and notify each trainer once per class", async () => {
    const admin = await fixtures.user("ADMIN");
    const first = await fixtures.user("TRAINER");
    const second = await fixtures.user("TRAINER");
    const branch = await fixtures.branch();
    await fixtures.scheduledClass({ weekStartsOn: WEEK, startsAt: "2036-03-03T15:00:00.000Z", branchId: branch.id, trainerId: first.id });
    await fixtures.scheduledClass({ weekStartsOn: WEEK, startsAt: "2036-03-05T15:00:00.000Z", branchId: branch.id, trainerId: first.id });
    await fixtures.scheduledClass({ weekStartsOn: WEEK, startsAt: "2036-03-06T15:00:00.000Z", branchId: branch.id, trainerId: second.id });
    await fixtures.scheduledClass({ weekStartsOn: WEEK, startsAt: "2036-03-07T15:00:00.000Z", branchId: branch.id, trainerId: null });
    const weekDate = new Date(`${WEEK}T00:00:00.000Z`);
    const source = await database.weeklySchedule.findUniqueOrThrow({ where: { weekStartsOn: weekDate }, select: { id: true } });
    const sourceBefore = await database.scheduledClass.findMany({ where: { scheduleId: source.id }, orderBy: { id: "asc" } });

    const results = await Promise.all(Array.from({ length: 5 }, () =>
      request(app).post(`/api/weekly-schedules/${source.id}/copies`).set(bearer(admin)).send({ weekStartsOn: NEXT_WEEK })));
    await fixtures.trackClassesOf(branch.id);

    expect(results.map(({ status }) => status).sort()).toEqual([201, 409, 409, 409, 409]);
    expect(await database.weeklySchedule.count({ where: { weekStartsOn: new Date(`${NEXT_WEEK}T00:00:00.000Z`) } })).toBe(1);
    const destination = await database.weeklySchedule.findUniqueOrThrow({ where: { weekStartsOn: new Date(`${NEXT_WEEK}T00:00:00.000Z`) }, select: { id: true } });
    expect(await database.scheduledClass.count({ where: { scheduleId: destination.id } })).toBe(4);
    // The history of the source week is exactly what it was.
    expect(await database.scheduledClass.findMany({ where: { scheduleId: source.id }, orderBy: { id: "asc" } })).toEqual(sourceBefore);

    expect(await titlesOf(first.id)).toEqual(["Clase asignada", "Clase asignada"]);
    expect(await titlesOf(second.id)).toEqual(["Clase asignada"]);
  });

  test("two different price increases registered at the same time are both announced to every active member", async () => {
    const admin = await fixtures.user("ADMIN");
    const members = [await fixtures.user("MEMBER"), await fixtures.user("MEMBER")];
    const publish = (amount: number, effectiveFrom: string) => request(app).post("/api/membership-prices")
      .set(bearer(admin)).set("Idempotency-Key", randomUUID()).send({ amount, effectiveFrom });
    expect((await publish(10000, "2090-01-01T03:00:00.000Z")).status).toBe(201);

    const [first, second] = await Promise.all([
      publish(12000, "2090-02-01T03:00:00.000Z"),
      publish(15000, "2090-03-01T03:00:00.000Z"),
    ]);
    await fixtures.trackPricesBy(admin.id);
    expect([first.status, second.status]).toEqual([201, 201]);

    for (const member of members) {
      expect((await noticesOf(member.id)).map(({ message }) => message).sort()).toEqual([
        "La cuota mensual pasa a ser de $ 12.000,00 desde el 01/02/2090.",
        "La cuota mensual pasa a ser de $ 15.000,00 desde el 01/03/2090.",
      ]);
    }
  });

  test("a class that is modified and deleted at the same time ends deleted with exactly one cancellation", async () => {
    const admin = await fixtures.user("ADMIN");
    const trainer = await fixtures.user("TRAINER");
    const branch = await fixtures.branch();
    const created = await request(app).post("/api/scheduled-classes").set(bearer(admin))
      .send({ weekStartsOn: WEEK, activity: "Yoga", startsAt: CLASS_AT, branchId: branch.id, trainerId: trainer.id });
    expect(created.status).toBe(201);
    await fixtures.trackClassesOf(branch.id);

    const [modified, removed] = await Promise.all([
      request(app).patch(`/api/scheduled-classes/${created.body.id}`).set(bearer(admin)).send({ activity: "Pilates" }),
      request(app).delete(`/api/scheduled-classes/${created.body.id}`).set(bearer(admin)),
    ]);

    expect(removed.status).toBe(204);
    expect([200, 404]).toContain(modified.status);
    expect(await database.scheduledClass.count({ where: { id: created.body.id } })).toBe(0);
    const notices = await noticesOf(trainer.id);
    expect(notices.filter(({ title }) => title === "Clase cancelada")).toHaveLength(1);
    expect(notices.filter(({ title }) => title === "Clase modificada")).toHaveLength(modified.status === 200 ? 1 : 0);
    // The cancellation describes the class as it was when it disappeared.
    const cancellation = notices.find(({ title }) => title === "Clase cancelada");
    expect(cancellation?.message).toContain(modified.status === 200 ? "Pilates" : "Yoga");
  });

  test("two simultaneous reassignments leave one trainer assigned and tell everybody the truth", async () => {
    const admin = await fixtures.user("ADMIN");
    const original = await fixtures.user("TRAINER");
    const candidates = [await fixtures.user("TRAINER"), await fixtures.user("TRAINER")];
    const branch = await fixtures.branch();
    const created = await request(app).post("/api/scheduled-classes").set(bearer(admin))
      .send({ weekStartsOn: WEEK, activity: "Yoga", startsAt: CLASS_AT, branchId: branch.id, trainerId: original.id });
    expect(created.status).toBe(201);
    await fixtures.trackClassesOf(branch.id);

    const results = await Promise.all(candidates.map((candidate) =>
      request(app).patch(`/api/scheduled-classes/${created.body.id}`).set(bearer(admin)).send({ trainerId: candidate.id })));
    expect(results.map(({ status }) => status)).toEqual([200, 200]);

    const { trainerId: finalTrainerId } = await database.scheduledClass.findUniqueOrThrow({ where: { id: created.body.id }, select: { trainerId: true } });
    expect(candidates.map(({ id }) => id)).toContain(finalTrainerId);
    expect(await titlesOf(original.id)).toEqual(["Clase asignada", "Clase reasignada"]);
    for (const candidate of candidates) {
      const titles = await titlesOf(candidate.id);
      // Both were assigned at some moment; only the one that lost the race was told it no longer has the class.
      expect(titles).toEqual(candidate.id === finalTrainerId ? ["Clase asignada"] : ["Clase asignada", "Clase reasignada"]);
    }
  });
});

describe("simultaneous openings of the inbox from several devices and server instances", () => {
  test("thirty openings spread over two server instances create a single expiring notice", async () => {
    const admin = await fixtures.user("ADMIN");
    const member = await fixtures.user("MEMBER");
    const now = new Date("2036-03-01T15:00:00.000Z");
    const expiresAt = new Date(now.getTime() + 3 * DAY);
    await fixtures.accreditedPayment(member.id, admin.id, new Date(expiresAt.getTime() - 30 * DAY).toISOString(), expiresAt.toISOString());

    const otherInstanceDatabase = createDatabaseClient();
    try {
      const instances = [
        createIntegrationApp({ now: () => now }),
        createIntegrationApp({ now: () => now, database: otherInstanceDatabase }),
      ];
      const openings = await Promise.all(Array.from({ length: 30 }, (_, index) =>
        request(instances[index % 2]!).get("/api/notifications?limit=100").set(bearer(member))));

      expect(openings.every(({ status }) => status === 200)).toBe(true);
      expect(await database.notification.count({ where: { userId: member.id } })).toBe(1);
      for (const opening of openings) {
        expect(opening.body.unreadCount).toBe(1);
        expect(opening.body.items.map(({ type }: { type: string }) => type)).toEqual(["MEMBERSHIP_EXPIRING"]);
      }
    } finally {
      await otherInstanceDatabase.$disconnect();
    }
  });
});
