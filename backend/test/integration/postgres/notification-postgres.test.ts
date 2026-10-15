import { randomUUID } from "node:crypto";

import { NotificationRepository, createNotifications } from "../../../src/repository/notification-repository.js";
import { ScheduledClassRepository } from "../../../src/repository/scheduled-class-repository.js";
import { createFixtures, database } from "./support/postgres-fixtures.js";

const fixtures = createFixtures();

afterEach(async () => {
  await fixtures.cleanup();
});

afterAll(async () => {
  await database.$disconnect();
});

describe("notification PostgreSQL integration", () => {
  beforeAll(async () => {
    await database.$connect();
  });

  test("isolates by user, reads one or all, filters unread, and paginates newest first without deleting history", async () => {
    const owner = await fixtures.user("MEMBER");
    const other = await fixtures.user("MEMBER");
    const ids = {
      newest: randomUUID(),
      middle: randomUUID(),
      oldest: randomUUID(),
      other: randomUUID(),
    };
    await database.notification.createMany({
      data: [
        { id: ids.newest, userId: owner.id, title: "Nuevo", message: "No leída", type: "GENERAL", createdAt: new Date("2030-03-03T12:00:00.000Z") },
        { id: ids.middle, userId: owner.id, title: "Intermedia", message: "Leída", type: "GENERAL", createdAt: new Date("2030-03-02T12:00:00.000Z"), readAt: new Date("2030-03-02T13:00:00.000Z") },
        { id: ids.oldest, userId: owner.id, title: "Anterior", message: "No leída", type: "GENERAL", createdAt: new Date("2030-03-01T12:00:00.000Z") },
        { id: ids.other, userId: other.id, title: "Privada", message: "De otro usuario", type: "GENERAL", createdAt: new Date("2030-03-04T12:00:00.000Z") },
      ],
    });

    const repository = new NotificationRepository(database);
    const firstPage = await repository.listOwn(owner.id, { page: 1, limit: 2 });
    const secondPage = await repository.listOwn(owner.id, { page: 2, limit: 2 });
    const unread = await repository.listOwn(owner.id, { page: 1, limit: 10, isRead: false });

    expect(firstPage.total).toBe(3);
    expect(firstPage.items.map(({ id }) => id)).toEqual([ids.newest, ids.middle]);
    expect(secondPage.items.map(({ id }) => id)).toEqual([ids.oldest]);
    expect(unread.total).toBe(2);
    expect(unread.items.map(({ id }) => id)).toEqual([ids.newest, ids.oldest]);
    expect(await repository.findOwn(ids.other, owner.id)).toBeNull();

    await repository.markOwnAsRead(ids.newest, owner.id);
    expect((await repository.findOwn(ids.newest, owner.id))?.readAt).toBeInstanceOf(Date);
    await repository.markOwnAsRead(ids.other, owner.id);
    await repository.markAllOwnAsRead(owner.id);

    const ownerHistory = await repository.listOwn(owner.id, { page: 1, limit: 10 });
    expect(ownerHistory.items).toHaveLength(3);
    expect(ownerHistory.items.every(({ readAt }) => readAt instanceof Date)).toBe(true);
    expect((await repository.findOwn(ids.other, other.id))?.readAt).toBeNull();
  });

  test("keeps A to B to A to B class changes distinct and suppresses an exact retry", async () => {
    const trainer = await fixtures.user("TRAINER");
    const branch = await fixtures.branch();
    const scheduledClass = await fixtures.scheduledClass({
      weekStartsOn: "2036-03-03",
      startsAt: "2036-03-03T15:00:00.000Z",
      branchId: branch.id,
      trainerId: trainer.id,
      activity: "A",
    });

    const repository = new ScheduledClassRepository(database);
    const now = new Date("2036-02-01T00:00:00.000Z");
    await repository.updateClass(scheduledClass.id, { activity: "B" }, now);
    await repository.updateClass(scheduledClass.id, { activity: "A" }, now);
    await repository.updateClass(scheduledClass.id, { activity: "B" }, now);

    const classNotifications = await database.notification.findMany({
      where: { userId: trainer.id, type: "CLASS_CHANGED" },
      select: { dedupeKey: true },
    });
    const changeKeys = classNotifications.map(({ dedupeKey }) => dedupeKey);
    expect(changeKeys).toHaveLength(3);
    expect(new Set(changeKeys).size).toBe(3);

    await repository.updateClass(scheduledClass.id, { activity: "B" }, now);
    expect(await database.notification.count({ where: { userId: trainer.id, type: "CLASS_CHANGED" } })).toBe(3);

    const retryKey = `class-changed:${scheduledClass.id}:${randomUUID()}:${trainer.id}`;
    const retriedEvent = {
      userId: trainer.id,
      title: "Cambio en tus clases",
      message: "Reintento del mismo evento.",
      type: "CLASS_CHANGED" as const,
      dedupeKey: retryKey,
    };
    await createNotifications(database, [retriedEvent]);
    await createNotifications(database, [retriedEvent]);
    expect(await database.notification.count({ where: { dedupeKey: retryKey } })).toBe(1);
  });
});
