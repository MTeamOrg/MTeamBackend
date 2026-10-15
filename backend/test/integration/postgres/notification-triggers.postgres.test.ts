import { randomUUID } from "node:crypto";

import request from "supertest";

import { bearer, createFixtures, createIntegrationApp, database } from "./support/postgres-fixtures.js";

const fixtures = createFixtures();
const app = createIntegrationApp();

// 2036-03-03 is a Monday. 02:30Z on the 4th is 23:30 on the 3rd in Buenos Aires, so a server that
// formats with its own zone (UTC) would announce the wrong day.
const WEEK = "2036-03-03";
const LATE_EVENING = "2036-03-04T02:30:00.000Z"; // 03/03/2036 23:30 ART
const NEXT_MORNING = "2036-03-04T13:00:00.000Z"; // 04/03/2036 10:00 ART

function notificationsOf(userId: string) {
  return database.notification.findMany({
    where: { userId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { title: true, message: true, type: true, dedupeKey: true, readAt: true },
  });
}

async function titlesOf(userId: string): Promise<string[]> {
  return (await notificationsOf(userId)).map(({ title }) => title).sort();
}

afterEach(async () => {
  await fixtures.cleanup();
});

afterAll(async () => {
  await database.$disconnect();
});

describe("class change notifications (API, services and PostgreSQL)", () => {
  async function setup() {
    const admin = await fixtures.user("ADMIN");
    const trainer = await fixtures.user("TRAINER");
    const branch = await fixtures.branch();
    return { admin, trainer, branch };
  }

  async function createClassThroughApi(admin: { id: string; role: "ADMIN" }, branchId: string, trainerId: string | null, startsAt = LATE_EVENING) {
    const response = await request(app).post("/api/scheduled-classes").set(bearer(admin)).send({
      weekStartsOn: WEEK, activity: "Yoga", startsAt, branchId, trainerId,
    });
    expect(response.status).toBe(201);
    await fixtures.trackClassesOf(branchId);
    return response.body.id as string;
  }

  test("announces an assignment with the Buenos Aires date, time and branch", async () => {
    const { admin, trainer, branch } = await setup();
    await createClassThroughApi(admin as never, branch.id, trainer.id);

    const [assigned, ...rest] = await notificationsOf(trainer.id);
    expect(rest).toHaveLength(0);
    expect(assigned).toMatchObject({ type: "CLASS_CHANGED", title: "Clase asignada", readAt: null });
    expect(assigned?.message).toBe(`Se te asignó la clase de Yoga el 03/03/2036 a las 23:30 en ${branch.name}.`);
  });

  test("keeps the cancellation notice when the class created for the same trainer is deleted", async () => {
    const { admin, trainer, branch } = await setup();
    const classId = await createClassThroughApi(admin as never, branch.id, trainer.id);

    const deleted = await request(app).delete(`/api/scheduled-classes/${classId}`).set(bearer(admin));
    expect(deleted.status).toBe(204);

    expect(await titlesOf(trainer.id)).toEqual(["Clase asignada", "Clase cancelada"]);
    const cancellation = (await notificationsOf(trainer.id)).find(({ title }) => title === "Clase cancelada");
    expect(cancellation?.message).toBe(`Se canceló la clase de Yoga del 03/03/2036 a las 23:30 en ${branch.name}.`);
  });

  test("does not notify anyone when a class without trainer is created and deleted", async () => {
    const { admin, trainer, branch } = await setup();
    const classId = await createClassThroughApi(admin as never, branch.id, null);
    expect((await request(app).delete(`/api/scheduled-classes/${classId}`).set(bearer(admin))).status).toBe(204);
    expect(await notificationsOf(trainer.id)).toHaveLength(0);
  });

  test("describes a schedule change and a branch change for the assigned trainer", async () => {
    const { admin, trainer, branch } = await setup();
    const otherBranch = await fixtures.branch();
    const classId = await createClassThroughApi(admin as never, branch.id, trainer.id);

    const rescheduled = await request(app).patch(`/api/scheduled-classes/${classId}`).set(bearer(admin)).send({ startsAt: NEXT_MORNING });
    expect(rescheduled.status).toBe(200);
    const moved = await request(app).patch(`/api/scheduled-classes/${classId}`).set(bearer(admin)).send({ branchId: otherBranch.id });
    expect(moved.status).toBe(200);

    const messages = (await notificationsOf(trainer.id)).filter(({ title }) => title === "Clase modificada").map(({ message }) => message).sort();
    expect(messages).toEqual([
      `Se modificó la clase de Yoga: el horario cambió del 03/03/2036 a las 23:30 al 04/03/2036 a las 10:00.`,
      `Se modificó la clase de Yoga: la sede cambió de ${branch.name} a ${otherBranch.name}.`,
    ].sort());
  });

  test("names the new activity when only the activity of a class changes", async () => {
    const { admin, trainer, branch } = await setup();
    const classId = await createClassThroughApi(admin as never, branch.id, trainer.id);

    const response = await request(app).patch(`/api/scheduled-classes/${classId}`).set(bearer(admin)).send({ activity: "Pilates" });
    expect(response.status).toBe(200);

    const update = (await notificationsOf(trainer.id)).find(({ title }) => title === "Clase modificada");
    expect(update?.message).toBe("Se modificó la clase de Pilates: la actividad cambió de Yoga a Pilates.");
  });

  test("notifies the previous trainer of the removal and the new trainer of the assignment, nobody else", async () => {
    const { admin, trainer, branch } = await setup();
    const replacement = await fixtures.user("TRAINER");
    const bystander = await fixtures.user("TRAINER");
    const classId = await createClassThroughApi(admin as never, branch.id, trainer.id);

    const reassigned = await request(app).patch(`/api/scheduled-classes/${classId}`).set(bearer(admin)).send({ trainerId: replacement.id });
    expect(reassigned.status).toBe(200);

    expect(await titlesOf(trainer.id)).toEqual(["Clase asignada", "Clase reasignada"]);
    expect((await notificationsOf(trainer.id)).find(({ title }) => title === "Clase reasignada")?.message)
      .toBe(`Ya no tenés asignada la clase de Yoga del 03/03/2036 a las 23:30 en ${branch.name}.`);
    expect(await notificationsOf(replacement.id)).toEqual([
      expect.objectContaining({
        title: "Clase asignada",
        message: `Se te asignó la clase de Yoga el 03/03/2036 a las 23:30 en ${branch.name}.`,
      }),
    ]);
    expect(await notificationsOf(bystander.id)).toHaveLength(0);

    const unassigned = await request(app).patch(`/api/scheduled-classes/${classId}`).set(bearer(admin)).send({ trainerId: null });
    expect(unassigned.status).toBe(200);
    expect(await titlesOf(replacement.id)).toEqual(["Clase asignada", "Clase reasignada"]);
  });

  test("tells each trainer about their own view when the trainer and the schedule change together", async () => {
    const { admin, trainer, branch } = await setup();
    const replacement = await fixtures.user("TRAINER");
    const classId = await createClassThroughApi(admin as never, branch.id, trainer.id);

    const response = await request(app).patch(`/api/scheduled-classes/${classId}`).set(bearer(admin)).send({ trainerId: replacement.id, startsAt: NEXT_MORNING });
    expect(response.status).toBe(200);

    expect((await notificationsOf(trainer.id)).find(({ title }) => title === "Clase reasignada")?.message)
      .toBe(`Ya no tenés asignada la clase de Yoga del 03/03/2036 a las 23:30 en ${branch.name}.`);
    expect((await notificationsOf(replacement.id))[0]?.message)
      .toBe(`Se te asignó la clase de Yoga el 04/03/2036 a las 10:00 en ${branch.name}.`);
  });

  test("keeps repeated real changes (A to B to A to B) and ignores an identical retry or concurrent copies of one request", async () => {
    const { admin, trainer, branch } = await setup();
    const classId = await createClassThroughApi(admin as never, branch.id, trainer.id);
    const patch = (startsAt: string) => request(app).patch(`/api/scheduled-classes/${classId}`).set(bearer(admin)).send({ startsAt });

    for (const startsAt of [NEXT_MORNING, LATE_EVENING, NEXT_MORNING]) expect((await patch(startsAt)).status).toBe(200);
    expect((await patch(NEXT_MORNING)).status).toBe(200); // exact retry: already applied
    expect((await notificationsOf(trainer.id)).filter(({ title }) => title === "Clase modificada")).toHaveLength(3);

    const concurrent = await Promise.all(Array.from({ length: 5 }, () => patch(LATE_EVENING)));
    expect(concurrent.every(({ status }) => status === 200)).toBe(true);
    expect((await notificationsOf(trainer.id)).filter(({ title }) => title === "Clase modificada")).toHaveLength(4);
  });

  test("does not notify when an update changes nothing", async () => {
    const { admin, trainer, branch } = await setup();
    const classId = await createClassThroughApi(admin as never, branch.id, trainer.id);
    const response = await request(app).patch(`/api/scheduled-classes/${classId}`).set(bearer(admin)).send({ activity: "Yoga", trainerId: trainer.id });
    expect(response.status).toBe(200);
    expect(await titlesOf(trainer.id)).toEqual(["Clase asignada"]);
  });

  test("notifies each assigned trainer once per copied class and not again when the copy is repeated", async () => {
    const { admin, trainer, branch } = await setup();
    const second = await fixtures.user("TRAINER");
    await fixtures.scheduledClass({ weekStartsOn: WEEK, startsAt: "2036-03-03T15:00:00.000Z", branchId: branch.id, trainerId: trainer.id });
    await fixtures.scheduledClass({ weekStartsOn: WEEK, startsAt: "2036-03-05T15:00:00.000Z", branchId: branch.id, trainerId: trainer.id });
    await fixtures.scheduledClass({ weekStartsOn: WEEK, startsAt: "2036-03-06T15:00:00.000Z", branchId: branch.id, trainerId: second.id });
    await fixtures.scheduledClass({ weekStartsOn: WEEK, startsAt: "2036-03-07T15:00:00.000Z", branchId: branch.id, trainerId: null });
    const source = await database.weeklySchedule.findUniqueOrThrow({ where: { weekStartsOn: new Date(`${WEEK}T00:00:00.000Z`) }, select: { id: true } });

    const copy = await request(app).post(`/api/weekly-schedules/${source.id}/copies`).set(bearer(admin)).send({ weekStartsOn: "2036-03-10" });
    expect(copy.status).toBe(201);
    await fixtures.trackClassesOf(branch.id);

    expect(await titlesOf(trainer.id)).toEqual(["Clase asignada", "Clase asignada"]);
    expect(await titlesOf(second.id)).toEqual(["Clase asignada"]);

    const repeated = await request(app).post(`/api/weekly-schedules/${source.id}/copies`).set(bearer(admin)).send({ weekStartsOn: "2036-03-10" });
    expect(repeated.status).toBe(409);
    expect(await titlesOf(trainer.id)).toHaveLength(2);
    expect(await titlesOf(second.id)).toHaveLength(1);
  });
});

describe("event cancellation notifications (API, services and PostgreSQL)", () => {
  async function setup(status: "DRAFT" | "PUBLISHED") {
    const admin = await fixtures.user("ADMIN");
    const memberA = await fixtures.user("MEMBER");
    const memberB = await fixtures.user("MEMBER");
    const trainer = await fixtures.user("TRAINER");
    const inactiveMember = await fixtures.user("MEMBER", { status: "INACTIVE" });
    const event = await fixtures.event(admin.id, status, LATE_EVENING);
    const cancel = () => request(app).patch(`/api/events/${event.id}/status`).set(bearer(admin)).send({ status: "CANCELLED" });
    return { admin, memberA, memberB, trainer, inactiveMember, event, cancel };
  }

  test("keeps the event and notifies active members and trainers with the Buenos Aires schedule", async () => {
    const { admin, memberA, memberB, trainer, inactiveMember, event, cancel } = await setup("PUBLISHED");

    const response = await cancel();
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: event.id, status: "CANCELLED" });
    expect(await database.event.count({ where: { id: event.id, status: "CANCELLED" } })).toBe(1);

    for (const recipient of [memberA, memberB, trainer]) {
      expect(await notificationsOf(recipient.id)).toEqual([
        expect.objectContaining({
          type: "EVENT_CANCELLED",
          title: "Evento cancelado",
          message: `Se canceló el evento "${event.title}" previsto para el 03/03/2036 a las 23:30.`,
        }),
      ]);
    }
    expect(await notificationsOf(inactiveMember.id)).toHaveLength(0);
    expect(await notificationsOf(admin.id)).toHaveLength(0);
  });

  test("does not notify again when the same cancellation is repeated or sent concurrently", async () => {
    const { memberA, trainer, cancel } = await setup("PUBLISHED");

    const results = await Promise.all(Array.from({ length: 5 }, () => cancel()));
    expect(results.every(({ status }) => status === 200)).toBe(true);
    expect((await cancel()).status).toBe(200);

    expect(await notificationsOf(memberA.id)).toHaveLength(1);
    expect(await notificationsOf(trainer.id)).toHaveLength(1);
  });

  test("does not announce the cancellation of an event that was never published", async () => {
    const { memberA, trainer, event, cancel } = await setup("DRAFT");

    const response = await cancel();
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: event.id, status: "CANCELLED" });

    expect(await notificationsOf(memberA.id)).toHaveLength(0);
    expect(await notificationsOf(trainer.id)).toHaveLength(0);
  });

  test("creating and publishing an event never notifies, and an unknown event answers 404", async () => {
    const admin = await fixtures.user("ADMIN");
    const member = await fixtures.user("MEMBER");
    const trainer = await fixtures.user("TRAINER");

    const created = await request(app).post("/api/events").set(bearer(admin)).send({
      title: "Torneo en preparación", description: "Evento de prueba", startsAt: LATE_EVENING, location: "Sede central", imageUrl: "https://example.test/evento.png",
    });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe("DRAFT");
    await fixtures.trackEventsBy(admin.id);

    const published = await request(app).patch(`/api/events/${created.body.id}/status`).set(bearer(admin)).send({ status: "PUBLISHED" });
    expect(published.status).toBe(200);
    expect(published.body.status).toBe("PUBLISHED");
    expect(await notificationsOf(member.id)).toHaveLength(0);
    expect(await notificationsOf(trainer.id)).toHaveLength(0);

    const unknown = await request(app).patch(`/api/events/${randomUUID()}/status`).set(bearer(admin)).send({ status: "CANCELLED" });
    expect(unknown.status).toBe(404);
  });

  test("rejects reopening a cancelled event without creating notices", async () => {
    const { admin, memberA, event, cancel } = await setup("PUBLISHED");
    expect((await cancel()).status).toBe(200);

    const reopen = await request(app).patch(`/api/events/${event.id}/status`).set(bearer(admin)).send({ status: "PUBLISHED" });
    expect(reopen.status).toBe(409);
    expect(await notificationsOf(memberA.id)).toHaveLength(1);
  });
});

describe("membership price notifications (API, services and PostgreSQL)", () => {
  async function setup() {
    const admin = await fixtures.user("ADMIN");
    const memberA = await fixtures.user("MEMBER");
    const memberB = await fixtures.user("MEMBER");
    const inactiveMember = await fixtures.user("MEMBER", { status: "INACTIVE" });
    const trainer = await fixtures.user("TRAINER");
    const publish = async (amount: number, effectiveFrom: string) => {
      const response = await request(app).post("/api/membership-prices").set(bearer(admin)).send({ amount, effectiveFrom });
      expect(response.status).toBe(201);
      await fixtures.trackPricesBy(admin.id);
    };
    return { admin, memberA, memberB, inactiveMember, trainer, publish };
  }

  test("notifies active members of an increase with the new amount and Buenos Aires effective date", async () => {
    const { memberA, memberB, inactiveMember, trainer, publish } = await setup();
    await publish(20000, "2090-01-01T03:00:00.000Z");
    await publish(25000.5, "2090-06-01T02:30:00.000Z"); // 31/05/2090 23:30 ART

    for (const member of [memberA, memberB]) {
      expect((await notificationsOf(member.id)).filter(({ type }) => type === "MEMBERSHIP_PRICE_CHANGED")).toEqual([
        expect.objectContaining({
          title: "Aumento de cuota",
          message: "La cuota mensual pasa a ser de $ 25.000,50 desde el 31/05/2090.",
        }),
      ]);
    }
    expect(await notificationsOf(inactiveMember.id)).toHaveLength(0);
    expect(await notificationsOf(trainer.id)).toHaveLength(0);
  });

  test("does not announce prices that are equal or lower than the previous one", async () => {
    const { memberA, publish } = await setup();
    await publish(20000, "2090-01-01T03:00:00.000Z");
    await publish(20000, "2090-02-01T03:00:00.000Z");
    await publish(18000, "2090-03-01T03:00:00.000Z");
    expect(await notificationsOf(memberA.id)).toHaveLength(0);

    await publish(21000, "2090-04-01T03:00:00.000Z");
    expect(await notificationsOf(memberA.id)).toHaveLength(1);
  });
});

describe("medical certificate result notifications (API, services and PostgreSQL)", () => {
  async function setup() {
    const admin = await fixtures.user("ADMIN");
    const owner = await fixtures.user("MEMBER");
    const other = await fixtures.user("MEMBER");
    const certificate = await fixtures.pendingCertificate(owner.id);
    const review = (body: Record<string, unknown>) => request(app)
      .patch(`/api/medical-certificates/${certificate.id}/review`).set(bearer(admin)).send(body);
    return { admin, owner, other, review };
  }

  test("tells only the owner that the certificate was approved", async () => {
    const { owner, other, review } = await setup();
    expect((await review({ status: "APPROVED" })).status).toBe(200);

    expect(await notificationsOf(owner.id)).toEqual([
      expect.objectContaining({
        type: "MEDICAL_CERTIFICATE_REVIEWED",
        title: "Apto médico aprobado",
        message: "Tu apto médico fue aprobado por un administrador.",
      }),
    ]);
    expect(await notificationsOf(other.id)).toHaveLength(0);
  });

  test("includes the recorded observation when the certificate is rejected", async () => {
    const { owner, other, review } = await setup();
    expect((await review({ status: "REJECTED" })).status).toBe(400);
    expect(await notificationsOf(owner.id)).toHaveLength(0);

    expect((await review({ status: "REJECTED", reviewComment: "  Falta la firma del profesional.  " })).status).toBe(200);
    expect(await notificationsOf(owner.id)).toEqual([
      expect.objectContaining({
        title: "Apto médico rechazado",
        message: "Tu apto médico fue rechazado. Observación: Falta la firma del profesional.",
      }),
    ]);
    expect(await notificationsOf(other.id)).toHaveLength(0);
  });

  test("produces a single notice when the same review is repeated or approve and reject race", async () => {
    const { owner, review } = await setup();
    const results = await Promise.all([
      review({ status: "APPROVED" }),
      review({ status: "REJECTED", reviewComment: "Ilegible" }),
      review({ status: "APPROVED" }),
    ]);
    expect(results.filter(({ status }) => status === 200)).toHaveLength(1);
    expect(results.filter(({ status }) => status === 409)).toHaveLength(2);
    expect((await review({ status: "APPROVED" })).status).toBe(409);
    expect(await notificationsOf(owner.id)).toHaveLength(1);
  });
});
