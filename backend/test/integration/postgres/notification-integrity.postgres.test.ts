import { randomUUID } from "node:crypto";

import request from "supertest";

import { bearer, createFixtures, createIntegrationApp, database } from "./support/postgres-fixtures.js";

/**
 * Transactional integrity: a business change and the notice it owes commit together or not at all.
 * A trigger on the disposable test database makes every notification insert fail, so each test proves
 * that the administrative operation leaves nothing half done, never leaks the database error, and
 * succeeds when the very same request is retried once notices can be stored again.
 */
const fixtures = createFixtures();
const app = createIntegrationApp();

const WEEK = "2036-03-03";
const NEXT_WEEK = "2036-03-10";
const CLASS_AT = "2036-03-04T13:00:00.000Z"; // 04/03/2036 10:00 ART
const TRIGGER = "test_reject_notification_insert";

async function rejectNotificationInserts(): Promise<void> {
  await database.$executeRawUnsafe(
    `CREATE OR REPLACE FUNCTION ${TRIGGER}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure while storing a notification'; END $$`,
  );
  await database.$executeRawUnsafe(
    `CREATE TRIGGER ${TRIGGER} BEFORE INSERT ON "notification" FOR EACH ROW EXECUTE FUNCTION ${TRIGGER}()`,
  );
}

async function allowNotificationInserts(): Promise<void> {
  await database.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${TRIGGER} ON "notification"`);
  await database.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${TRIGGER}()`);
}

function noticesOf(userId: string) {
  return database.notification.findMany({ where: { userId }, select: { title: true, type: true }, orderBy: { createdAt: "asc" } });
}

/** The API answers a generic 500 (SEG-02): neither the injected message nor any SQL reaches the client. */
function expectGenericFailure(response: { status: number; body: unknown; text: string }): void {
  expect(response.status).toBe(500);
  expect(response.body).toEqual({ code: "INTERNAL_ERROR", message: "Ocurrió un error interno", details: null });
  expect(response.text).not.toMatch(/injected|trigger|notification|SELECT|INSERT/i);
}

const originalConsoleError = console.error;
let serverErrors: unknown[][] = [];

beforeAll(allowNotificationInserts); // a previous aborted run must not leave the trigger behind

beforeEach(() => {
  serverErrors = [];
  console.error = (...args: unknown[]) => { serverErrors.push(args); }; // the error middleware logs the real error
});

afterEach(async () => {
  console.error = originalConsoleError;
  await allowNotificationInserts();
  await fixtures.cleanup();
});

afterAll(async () => {
  await allowNotificationInserts();
  await database.$disconnect();
});

describe("a failure while storing the notice undoes the administrative operation", () => {
  test("membership price: the price, its idempotency key and the notices are all discarded, and the same key works on retry", async () => {
    const admin = await fixtures.user("ADMIN");
    const member = await fixtures.user("MEMBER");
    const publish = (amount: number, effectiveFrom: string, key: string) => request(app)
      .post("/api/membership-prices").set(bearer(admin)).set("Idempotency-Key", key).send({ amount, effectiveFrom });
    expect((await publish(20000, "2090-01-01T03:00:00.000Z", randomUUID())).status).toBe(201); // the first price announces nothing
    await fixtures.trackPricesBy(admin.id);

    const key = randomUUID();
    await rejectNotificationInserts();
    expectGenericFailure(await publish(25000, "2090-02-01T03:00:00.000Z", key));
    expect(serverErrors.length).toBeGreaterThan(0); // the real cause is kept for the server log
    expect(await database.membershipPrice.count({ where: { createdById: admin.id } })).toBe(1);
    expect(await database.membershipPrice.findUnique({ where: { idempotencyKey: key } })).toBeNull();
    expect(await noticesOf(member.id)).toHaveLength(0);

    await allowNotificationInserts();
    const retried = await publish(25000, "2090-02-01T03:00:00.000Z", key);
    expect(retried.status).toBe(201);
    await fixtures.trackPricesBy(admin.id);
    expect(await database.membershipPrice.count({ where: { createdById: admin.id } })).toBe(2);
    expect(await noticesOf(member.id)).toEqual([{ title: "Aumento de cuota", type: "MEMBERSHIP_PRICE_CHANGED" }]);
  });

  test("medical certificate: it stays pending, with no reviewer or date, and can be reviewed again", async () => {
    const admin = await fixtures.user("ADMIN");
    const owner = await fixtures.user("MEMBER");
    const certificate = await fixtures.pendingCertificate(owner.id);
    const review = () => request(app).patch(`/api/medical-certificates/${certificate.id}/review`).set(bearer(admin))
      .send({ status: "REJECTED", reviewComment: "Falta la firma del profesional." });

    await rejectNotificationInserts();
    expectGenericFailure(await review());
    expect(await database.medicalCertificate.findUniqueOrThrow({ where: { id: certificate.id } }))
      .toMatchObject({ status: "PENDING", reviewedById: null, reviewedAt: null, reviewComment: null });
    expect(await noticesOf(owner.id)).toHaveLength(0);

    await allowNotificationInserts();
    expect((await review()).status).toBe(200);
    expect(await database.medicalCertificate.findUniqueOrThrow({ where: { id: certificate.id } }))
      .toMatchObject({ status: "REJECTED", reviewedById: admin.id });
    expect(await noticesOf(owner.id)).toEqual([{ title: "Apto médico rechazado", type: "MEDICAL_CERTIFICATE_REVIEWED" }]);
  });

  test("class creation: neither the class nor a week created only for it remains", async () => {
    const admin = await fixtures.user("ADMIN");
    const trainer = await fixtures.user("TRAINER");
    const branch = await fixtures.branch();
    const create = () => request(app).post("/api/scheduled-classes").set(bearer(admin))
      .send({ weekStartsOn: WEEK, activity: "Yoga", startsAt: CLASS_AT, branchId: branch.id, trainerId: trainer.id });

    await rejectNotificationInserts();
    expectGenericFailure(await create());
    expect(await database.scheduledClass.count({ where: { branchId: branch.id } })).toBe(0);
    expect(await database.weeklySchedule.count({ where: { weekStartsOn: new Date(`${WEEK}T00:00:00.000Z`) } })).toBe(0);
    expect(await noticesOf(trainer.id)).toHaveLength(0);

    await allowNotificationInserts();
    expect((await create()).status).toBe(201);
    await fixtures.trackClassesOf(branch.id);
    expect(await noticesOf(trainer.id)).toEqual([{ title: "Clase asignada", type: "CLASS_CHANGED" }]);
  });

  test("class change: the class keeps its previous data and the retry applies it once", async () => {
    const admin = await fixtures.user("ADMIN");
    const trainer = await fixtures.user("TRAINER");
    const branch = await fixtures.branch();
    const created = await request(app).post("/api/scheduled-classes").set(bearer(admin))
      .send({ weekStartsOn: WEEK, activity: "Yoga", startsAt: CLASS_AT, branchId: branch.id, trainerId: trainer.id });
    expect(created.status).toBe(201);
    await fixtures.trackClassesOf(branch.id);
    const change = () => request(app).patch(`/api/scheduled-classes/${created.body.id}`).set(bearer(admin)).send({ activity: "Pilates" });

    await rejectNotificationInserts();
    expectGenericFailure(await change());
    expect((await database.scheduledClass.findUniqueOrThrow({ where: { id: created.body.id } })).activity).toBe("Yoga");
    expect(await noticesOf(trainer.id)).toHaveLength(1);

    await allowNotificationInserts();
    expect((await change()).status).toBe(200);
    expect((await database.scheduledClass.findUniqueOrThrow({ where: { id: created.body.id } })).activity).toBe("Pilates");
    expect((await noticesOf(trainer.id)).map(({ title }) => title)).toEqual(["Clase asignada", "Clase modificada"]);
  });

  test("class deletion: the class is still there and the cancellation is announced when the retry succeeds", async () => {
    const admin = await fixtures.user("ADMIN");
    const trainer = await fixtures.user("TRAINER");
    const branch = await fixtures.branch();
    const scheduled = await fixtures.scheduledClass({ weekStartsOn: WEEK, startsAt: CLASS_AT, branchId: branch.id, trainerId: trainer.id });
    const remove = () => request(app).delete(`/api/scheduled-classes/${scheduled.id}`).set(bearer(admin));

    await rejectNotificationInserts();
    expectGenericFailure(await remove());
    expect(await database.scheduledClass.count({ where: { id: scheduled.id } })).toBe(1);
    expect(await noticesOf(trainer.id)).toHaveLength(0);

    await allowNotificationInserts();
    expect((await remove()).status).toBe(204);
    expect(await database.scheduledClass.count({ where: { id: scheduled.id } })).toBe(0);
    expect(await noticesOf(trainer.id)).toEqual([{ title: "Clase cancelada", type: "CLASS_CHANGED" }]);
  });

  test("weekly copy: no destination week, no classes and no notices remain, and the retry copies once", async () => {
    const admin = await fixtures.user("ADMIN");
    const trainer = await fixtures.user("TRAINER");
    const branch = await fixtures.branch();
    await fixtures.scheduledClass({ weekStartsOn: WEEK, startsAt: CLASS_AT, branchId: branch.id, trainerId: trainer.id });
    const source = await database.weeklySchedule.findUniqueOrThrow({ where: { weekStartsOn: new Date(`${WEEK}T00:00:00.000Z`) }, select: { id: true } });
    const copy = () => request(app).post(`/api/weekly-schedules/${source.id}/copies`).set(bearer(admin)).send({ weekStartsOn: NEXT_WEEK });

    await rejectNotificationInserts();
    expectGenericFailure(await copy());
    expect(await database.weeklySchedule.count({ where: { weekStartsOn: new Date(`${NEXT_WEEK}T00:00:00.000Z`) } })).toBe(0);
    expect(await database.scheduledClass.count({ where: { branchId: branch.id } })).toBe(1);
    expect(await noticesOf(trainer.id)).toHaveLength(0);

    await allowNotificationInserts();
    expect((await copy()).status).toBe(201);
    await fixtures.trackClassesOf(branch.id);
    expect(await database.scheduledClass.count({ where: { branchId: branch.id } })).toBe(2);
    expect(await noticesOf(trainer.id)).toEqual([{ title: "Clase asignada", type: "CLASS_CHANGED" }]);
  });

  test("event cancellation: the event stays published and announces nothing until the retry succeeds", async () => {
    const admin = await fixtures.user("ADMIN");
    const member = await fixtures.user("MEMBER");
    const trainer = await fixtures.user("TRAINER");
    const event = await fixtures.event(admin.id, "PUBLISHED");
    const cancel = () => request(app).patch(`/api/events/${event.id}/status`).set(bearer(admin)).send({ status: "CANCELLED" });

    await rejectNotificationInserts();
    expectGenericFailure(await cancel());
    expect((await database.event.findUniqueOrThrow({ where: { id: event.id } })).status).toBe("PUBLISHED");
    expect(await noticesOf(member.id)).toHaveLength(0);
    expect(await noticesOf(trainer.id)).toHaveLength(0);

    await allowNotificationInserts();
    expect((await cancel()).status).toBe(200);
    expect((await database.event.findUniqueOrThrow({ where: { id: event.id } })).status).toBe("CANCELLED");
    expect(await noticesOf(member.id)).toEqual([{ title: "Evento cancelado", type: "EVENT_CANCELLED" }]);
    expect(await noticesOf(trainer.id)).toEqual([{ title: "Evento cancelado", type: "EVENT_CANCELLED" }]);
  });
});

describe("operations that owe no notice do not touch the notification table", () => {
  test("classes without trainer, drafts and prices that are not increases succeed even while storing notices fails", async () => {
    const admin = await fixtures.user("ADMIN");
    await fixtures.user("MEMBER");
    const branch = await fixtures.branch();
    await rejectNotificationInserts();

    const unassigned = await request(app).post("/api/scheduled-classes").set(bearer(admin))
      .send({ weekStartsOn: WEEK, activity: "Yoga", startsAt: CLASS_AT, branchId: branch.id, trainerId: null });
    expect(unassigned.status).toBe(201);
    await fixtures.trackClassesOf(branch.id);
    expect((await request(app).delete(`/api/scheduled-classes/${unassigned.body.id}`).set(bearer(admin))).status).toBe(204);

    const draft = await fixtures.event(admin.id, "DRAFT");
    expect((await request(app).patch(`/api/events/${draft.id}/status`).set(bearer(admin)).send({ status: "CANCELLED" })).status).toBe(200);

    // The lowest possible amount is never an increase, whatever other prices the database holds.
    const notAnIncrease = await request(app).post("/api/membership-prices").set(bearer(admin)).set("Idempotency-Key", randomUUID())
      .send({ amount: 0.01, effectiveFrom: "2090-01-01T03:00:00.000Z" });
    expect(notAnIncrease.status).toBe(201);
    await fixtures.trackPricesBy(admin.id);
  });
});
