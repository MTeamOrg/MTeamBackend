import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../src/generated/prisma/client.js";
import { NotificationRepository, createNotifications } from "../../../src/repository/notification-repository.js";
import { ScheduledClassRepository } from "../../../src/repository/scheduled-class-repository.js";

const connectionString = process.env.NOTIFICATION_TEST_DATABASE_URL;
if (!connectionString) {
  throw new Error("Set NOTIFICATION_TEST_DATABASE_URL to a disposable local PostgreSQL database before running this integration test.");
}

const parsedConnectionString = new URL(connectionString);
const databaseName = decodeURIComponent(parsedConnectionString.pathname.slice(1)).toLowerCase();
if (!(["localhost", "127.0.0.1"].includes(parsedConnectionString.hostname) && databaseName.includes("test"))) {
  throw new Error("Notification integration tests only accept a loopback PostgreSQL database with 'test' in its name.");
}

const database = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const userIds: string[] = [];
const branchIds: string[] = [];
const scheduleIds: string[] = [];
const classIds: string[] = [];

async function createUser(role: "MEMBER" | "TRAINER") {
  const unique = randomUUID();
  const user = await database.user.create({
    data: {
      firstName: "Notification",
      lastName: "Integration",
      documentNumber: unique.replace(/-/g, "").slice(0, 30),
      birthDate: new Date("1990-01-01T00:00:00.000Z"),
      email: `${unique}@example.test`,
      phone: "555-0100",
      passwordHash: "test-only-hash",
      role,
      isPasswordChangeRequired: false,
      ...(role === "TRAINER" ? {
        trainerProfile: { create: { specialty: "Fitness", description: "PostgreSQL integration fixture" } },
      } : {}),
    },
    select: { id: true },
  });
  userIds.push(user.id);
  return user;
}

afterAll(async () => {
  await database.$disconnect();
});

afterEach(async () => {
  if (classIds.length) await database.scheduledClass.deleteMany({ where: { id: { in: classIds } } });
  if (scheduleIds.length) await database.weeklySchedule.deleteMany({ where: { id: { in: scheduleIds } } });
  if (branchIds.length) await database.branch.deleteMany({ where: { id: { in: branchIds } } });
  if (userIds.length) {
    await database.notification.deleteMany({ where: { userId: { in: userIds } } });
    await database.trainerProfile.deleteMany({ where: { userId: { in: userIds } } });
    await database.user.deleteMany({ where: { id: { in: userIds } } });
  }
  classIds.length = 0;
  scheduleIds.length = 0;
  branchIds.length = 0;
  userIds.length = 0;
});

describe("notification PostgreSQL integration", () => {
  beforeAll(async () => {
    await database.$connect();
  });

  test("isolates by user, reads one or all, filters unread, and paginates newest first without deleting history", async () => {
    const owner = await createUser("MEMBER");
    const other = await createUser("MEMBER");
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
    const trainer = await createUser("TRAINER");
    const branch = await database.branch.create({
      data: {
        name: `Notification ${randomUUID()}`,
        description: "PostgreSQL integration fixture",
        imageUrl: "https://example.test/branch.png",
        address: `Notification test ${randomUUID()}`,
        openingHours: "08:00-20:00",
        phone: "555-0100",
      },
      select: { id: true },
    });
    branchIds.push(branch.id);
    const weekStartsOn = new Date("2036-03-03T00:00:00.000Z");
    const schedule = await database.weeklySchedule.create({ data: { weekStartsOn }, select: { id: true } });
    scheduleIds.push(schedule.id);
    const scheduledClass = await database.scheduledClass.create({
      data: {
        scheduleId: schedule.id,
        branchId: branch.id,
        trainerId: trainer.id,
        activity: "A",
        startsAt: new Date("2036-03-03T15:00:00.000Z"),
      },
      select: { id: true },
    });
    classIds.push(scheduledClass.id);

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
