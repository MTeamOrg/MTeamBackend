import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { NotificationRepository } from "../../src/repository/notification-repository.js";
import { NotificationService } from "../../src/service/notification-service.js";

const userId = "own-user";
function setup() {
  const notification = { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null), updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    createMany: jest.fn().mockResolvedValue({ count: 1 }) };
  const user = { findUnique: jest.fn().mockResolvedValue({ role: "MEMBER" }) };
  const payment = { findFirst: jest.fn().mockResolvedValue(null) };
  const database = { notification, user, payment, $transaction: (values: Promise<unknown>[]) => Promise.all(values) } as unknown as PrismaClient;
  const repository = new NotificationRepository(database);
  return { notification, user, payment, repository, service: new NotificationService(repository) };
}
describe("NOV-04 own inbox", () => {
  test("paginates newest first with a stable tie breaker and own-user filter", async () => {
    const { repository, notification } = setup();
    await repository.listOwn(userId, { page: 2, limit: 20, isRead: false });
    expect(notification.count).toHaveBeenCalledWith({ where: { userId, readAt: null } });
    expect(notification.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId, readAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: 20, take: 20 }));
  });
  test("rejects another user's notification without writing", async () => {
    const { service, notification } = setup();
    await expect(service.markOwnAsRead("foreign-id", userId)).rejects.toMatchObject({ statusCode: 404 });
    expect(notification.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "foreign-id", userId } }));
    expect(notification.updateMany).not.toHaveBeenCalled();
  });
  test("reading never deletes history or overwrites a previous read date", async () => {
    const { repository, notification } = setup();
    await repository.markOwnAsRead("own-id", userId);
    await repository.markAllOwnAsRead(userId);
    expect(notification.updateMany).toHaveBeenNthCalledWith(1, { where: { id: "own-id", userId, readAt: null }, data: { readAt: expect.any(Date) } });
    expect(notification.updateMany).toHaveBeenNthCalledWith(2, { where: { userId, readAt: null }, data: { readAt: expect.any(Date) } });
  });
});
describe("NOV-03 membership recipients", () => {
  test.each(["TRAINER", "ADMIN"])("does not create membership notices for %s", async role => {
    const { repository, user, notification, payment } = setup();
    user.findUnique.mockResolvedValue({ role });
    await repository.ensureMembershipStatusNotification(userId, new Date("2030-10-01T00:00:00Z"));
    expect(notification.createMany).not.toHaveBeenCalled();
    expect(payment.findFirst).not.toHaveBeenCalled();
  });
  test.each([null, new Date("2030-09-30T00:00:00Z")])("creates expired notice for the member only (%s)", async expiresAt => {
    const { repository, notification, payment } = setup();
    payment.findFirst.mockResolvedValue(expiresAt ? { expiresAt } : null);
    await repository.ensureMembershipStatusNotification(userId, new Date("2030-10-01T00:00:00Z"));
    expect(notification.createMany).toHaveBeenCalledWith({ skipDuplicates: true, data: [expect.objectContaining({ userId, type: "MEMBERSHIP_EXPIRED" })] });
  });
  test("does not notify a member with more than five days remaining", async () => {
    const { repository, notification, payment } = setup();
    payment.findFirst.mockResolvedValue({ expiresAt: new Date("2030-10-07T00:00:00Z") });
    await repository.ensureMembershipStatusNotification(userId, new Date("2030-10-01T00:00:00Z"));
    expect(notification.createMany).not.toHaveBeenCalled();
  });
});
