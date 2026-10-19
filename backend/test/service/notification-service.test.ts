import { ApplicationError } from "../../src/error/application-error.js";
import type { NotificationRepositoryPort } from "../../src/repository/notification-repository.js";
import { NotificationService } from "../../src/service/notification-service.js";

const userId = "7c1b6b1e-34f1-4a64-a2a5-0c6e1f6a1111";
const notification = {
  id: "d12101a5-e6ab-43f7-91b3-2b8fbfd67b84", userId, title: "Aviso", message: "Mensaje",
  type: "GENERAL" as const, createdAt: new Date("2030-01-01T00:00:00.000Z"), readAt: null,
};

function setup(now = new Date("2036-03-01T15:00:00.000Z")) {
  const repository: jest.Mocked<NotificationRepositoryPort> = {
    listOwn: jest.fn().mockResolvedValue({ items: [notification], page: 1, limit: 20, total: 1, unreadCount: 1 }),
    findOwn: jest.fn().mockResolvedValue(notification),
    markOwnAsRead: jest.fn().mockResolvedValue(undefined),
    markAllOwnAsRead: jest.fn().mockResolvedValue(undefined),
    ensureMembershipStatusNotification: jest.fn().mockResolvedValue(undefined),
  };
  return { repository, service: new NotificationService(repository, () => now) };
}

describe("NotificationService", () => {
  test("refreshes the fee notice with the injected clock before listing", async () => {
    const now = new Date("2036-03-01T15:00:00.000Z");
    const { service, repository } = setup(now);
    const order: string[] = [];
    repository.ensureMembershipStatusNotification.mockImplementation(async () => { order.push("ensure"); });
    repository.listOwn.mockImplementation(async () => { order.push("list"); return { items: [], page: 1, limit: 20, total: 0, unreadCount: 0 }; });

    await service.listOwn(userId, { page: 1, limit: 20 });
    expect(repository.ensureMembershipStatusNotification).toHaveBeenCalledWith(userId, now);
    expect(order).toEqual(["ensure", "list"]);
  });

  test("keeps the inbox readable when the fee notice cannot be generated", async () => {
    const { service, repository } = setup();
    const failure = new Error("temporary database problem");
    repository.ensureMembershipStatusNotification.mockRejectedValue(failure);
    const logged = jest.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(service.listOwn(userId, { page: 1, limit: 20 })).resolves.toMatchObject({ unreadCount: 1, total: 1 });
    expect(logged).toHaveBeenCalledWith("No se pudo actualizar el aviso de cuota", failure);
    logged.mockRestore();
  });

  test("still reports a failure of the query that reads the inbox", async () => {
    const { service, repository } = setup();
    repository.listOwn.mockRejectedValue(new Error("database down"));
    await expect(service.listOwn(userId, { page: 1, limit: 20 })).rejects.toThrow("database down");
  });

  test("answers 404 for a notification that is not the user's, without writing", async () => {
    const { service, repository } = setup();
    repository.findOwn.mockResolvedValue(null);
    await expect(service.getOwn("foreign", userId)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.markOwnAsRead("foreign", userId)).rejects.toBeInstanceOf(ApplicationError);
    expect(repository.findOwn).toHaveBeenCalledWith("foreign", userId);
    expect(repository.markOwnAsRead).not.toHaveBeenCalled();
  });

  test("marks one or all of the user's notifications as read", async () => {
    const { service, repository } = setup();
    await service.markOwnAsRead(notification.id, userId);
    await service.markAllOwnAsRead(userId);
    expect(repository.markOwnAsRead).toHaveBeenCalledWith(notification.id, userId);
    expect(repository.markAllOwnAsRead).toHaveBeenCalledWith(userId);
  });
});
