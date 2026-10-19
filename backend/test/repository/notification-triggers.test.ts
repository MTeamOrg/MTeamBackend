import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { MembershipPriceRepository } from "../../src/repository/membership-price-repository.js";
import { MedicalCertificateRepository } from "../../src/repository/medical-certificate-repository.js";
import { EventRepository } from "../../src/repository/event-repository.js";
import { NotificationRepository } from "../../src/repository/notification-repository.js";

const memberId = "212a6da6-063c-44c9-b63c-1d67602cb487";
const adminId = "a69a0192-a9a9-4936-8c79-bc5ff13d8dc2";
const certificateId = "f12101a5-e6ab-43f7-91b3-2b8fbfd67b84";

describe("notification triggers", () => {
  test("CUO-06 notifies active members only when the price increases", async () => {
    const executeRaw = jest.fn().mockResolvedValue(1);
    const transaction = {
      membershipPrice: {
        create: jest.fn().mockResolvedValue({ id: "price-2", amount: { toString: () => "20000.00" }, effectiveFrom: new Date("2030-10-01T00:00:00.000Z"), createdAt: new Date("2030-09-01T00:00:00.000Z"), createdById: adminId }),
        findFirst: jest.fn().mockResolvedValue({ amount: { toString: () => "18000.00" } }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $executeRaw: executeRaw,
      user: { findMany: jest.fn() },
      notification: { createMany: jest.fn() },
    };
    const runTransaction = jest.fn((callback: (value: typeof transaction) => Promise<unknown>, _options?: unknown) => callback(transaction));
    const database = { $transaction: runTransaction } as unknown as PrismaClient;

    await new MembershipPriceRepository(database).createPrice({ amount: "20000", effectiveFrom: new Date("2030-10-01T00:00:00.000Z"), createdById: adminId, idempotencyKey: "32f4164a-f26b-473a-901c-a2c8fd5dc3a8" });
    // Notifying every active member must not rely on Prisma's 5 s default for interactive transactions.
    expect(runTransaction).toHaveBeenCalledWith(expect.any(Function), { maxWait: 10_000, timeout: 60_000 });
    // The audience is selected and inserted in one database statement; IDs are not loaded into Node.
    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(transaction.user.findMany).not.toHaveBeenCalled();
    expect(transaction.notification.createMany).not.toHaveBeenCalled();
  });

  test.each(["20000.00", "18000.00", "19999.99"])("CUO-06 does not notify when the new price is %s and the previous one is 20000.00", async (amount) => {
    const notificationCreateMany = jest.fn();
    const transaction = {
      membershipPrice: {
        create: jest.fn().mockResolvedValue({ id: "price-2", amount: { toString: () => amount }, effectiveFrom: new Date("2030-10-01T00:00:00.000Z"), createdAt: new Date(), createdById: adminId }),
        findFirst: jest.fn().mockResolvedValue({ amount: { toString: () => "20000.00" } }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      user: { findMany: jest.fn() },
      $executeRaw: jest.fn(),
      notification: { createMany: notificationCreateMany },
    };
    const database = { $transaction: (callback: (value: typeof transaction) => Promise<unknown>) => callback(transaction) } as unknown as PrismaClient;

    await new MembershipPriceRepository(database).createPrice({ amount, effectiveFrom: new Date("2030-10-01T00:00:00.000Z"), createdById: adminId, idempotencyKey: "32f4164a-f26b-473a-901c-a2c8fd5dc3a8" });
    expect(transaction.user.findMany).not.toHaveBeenCalled();
    expect(transaction.$executeRaw).not.toHaveBeenCalled();
    expect(notificationCreateMany).not.toHaveBeenCalled();
  });

  test("CUO-06 does not notify for the very first price", async () => {
    const notificationCreateMany = jest.fn();
    const transaction = {
      membershipPrice: {
        create: jest.fn().mockResolvedValue({ id: "price-1", amount: { toString: () => "20000.00" }, effectiveFrom: new Date("2030-10-01T00:00:00.000Z"), createdAt: new Date(), createdById: adminId }),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      user: { findMany: jest.fn() },
      $executeRaw: jest.fn(),
      notification: { createMany: notificationCreateMany },
    };
    const database = { $transaction: (callback: (value: typeof transaction) => Promise<unknown>) => callback(transaction) } as unknown as PrismaClient;

    await new MembershipPriceRepository(database).createPrice({ amount: "20000", effectiveFrom: new Date("2030-10-01T00:00:00.000Z"), createdById: adminId, idempotencyKey: "32f4164a-f26b-473a-901c-a2c8fd5dc3a8" });
    expect(transaction.$executeRaw).not.toHaveBeenCalled();
    expect(notificationCreateMany).not.toHaveBeenCalled();
  });

  test.each(["APPROVED", "REJECTED"] as const)("APM-06 notifies only the owner for %s", async status => {
    const notificationCreateMany = jest.fn().mockResolvedValue({ count: 1 });
    const certificate = { id: certificateId, memberId, status: "REJECTED", uploadedAt: new Date(), reviewedById: adminId, reviewedAt: new Date(), reviewComment: "Falta firma", member: { id: memberId, firstName: "Ana", lastName: "Pérez", documentNumber: "123", email: "ana@example.com" }, reviewedBy: { id: adminId, firstName: "Admin", lastName: "M", } };
    const transaction = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: certificateId }]),
      medicalCertificate: {
        findUnique: jest.fn().mockResolvedValue({ status: "PENDING", memberId }),
        update: jest.fn().mockResolvedValue(certificate),
      },
      notification: { createMany: notificationCreateMany },
    };
    const database = { $transaction: (callback: (value: typeof transaction) => Promise<unknown>) => callback(transaction) } as unknown as PrismaClient;
    const repository = new MedicalCertificateRepository(database);

    await repository.review(certificateId, adminId, { status, reviewComment: status === "REJECTED" ? "Falta firma" : undefined });
    expect(notificationCreateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ userId: memberId, type: "MEDICAL_CERTIFICATE_REVIEWED", message: expect.stringContaining(status === "REJECTED" ? "Falta firma" : "aprobado") })],
    }));
  });

  test("cancelling an event keeps the record and notifies active members and trainers", async () => {
    const executeRaw = jest.fn().mockResolvedValue(2);
    const event = {
      id: "event-1", title: "Torneo", description: "D", startsAt: new Date("2030-10-01T12:00:00.000Z"),
      location: "Sede", imageUrl: "https://example.com/event.jpg", status: "PUBLISHED", createdById: adminId,
    };
    const transaction = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: event.id }]),
      event: {
        findUnique: jest.fn().mockResolvedValue(event),
        update: jest.fn().mockResolvedValue({ ...event, status: "CANCELLED" }),
      },
      $executeRaw: executeRaw,
      user: { findMany: jest.fn() },
      notification: { createMany: jest.fn() },
    };
    const runTransaction = jest.fn((callback: (value: typeof transaction) => Promise<unknown>, _options?: unknown) => callback(transaction));
    const database = { $transaction: runTransaction } as unknown as PrismaClient;

    await new EventRepository(database).updateStatus(event.id, { status: "CANCELLED" });
    // Notifying every active user must not rely on Prisma's 5 s default for interactive transactions.
    expect(runTransaction).toHaveBeenCalledWith(expect.any(Function), { maxWait: 10_000, timeout: 60_000 });
    expect(transaction.$queryRaw).toHaveBeenCalledTimes(1);
    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(transaction.user.findMany).not.toHaveBeenCalled();
    expect(transaction.notification.createMany).not.toHaveBeenCalled();
  });

  test.each(["DRAFT", "CANCELLED"] as const)("EVE-03 does not announce a cancellation that starts from %s", async (previous) => {
    const notificationCreateMany = jest.fn();
    const event = {
      id: "event-1", title: "Torneo", description: "D", startsAt: new Date("2030-10-01T12:00:00.000Z"),
      location: "Sede", imageUrl: "https://example.com/event.jpg", status: previous, createdById: adminId,
    };
    const transaction = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: event.id }]),
      event: {
        findUnique: jest.fn().mockResolvedValue(event),
        update: jest.fn().mockResolvedValue({ ...event, status: "CANCELLED" }),
      },
      user: { findMany: jest.fn() },
      $executeRaw: jest.fn(),
      notification: { createMany: notificationCreateMany },
    };
    const database = { $transaction: (callback: (value: typeof transaction) => Promise<unknown>) => callback(transaction) } as unknown as PrismaClient;

    await new EventRepository(database).updateStatus(event.id, { status: "CANCELLED" });
    expect(transaction.user.findMany).not.toHaveBeenCalled();
    expect(transaction.$executeRaw).not.toHaveBeenCalled();
    expect(notificationCreateMany).not.toHaveBeenCalled();
  });

  test("creates one expiring membership notice per expiration date", async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 1 });
    const database = {
      user: { findUnique: jest.fn().mockResolvedValue({ role: "MEMBER" }) },
      payment: { findFirst: jest.fn().mockResolvedValue({ expiresAt: new Date("2030-10-04T12:00:00.000Z") }) },
      notification: { createMany },
    } as unknown as PrismaClient;
    await new NotificationRepository(database).ensureMembershipStatusNotification(memberId, new Date("2030-10-01T12:00:00.000Z"));
    expect(createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ type: "MEMBERSHIP_EXPIRING", dedupeKey: expect.stringContaining("2030-10-04") })],
      skipDuplicates: true,
    }));
  });
});
