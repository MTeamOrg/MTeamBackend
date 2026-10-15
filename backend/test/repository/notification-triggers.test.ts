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
    const notificationCreateMany = jest.fn().mockResolvedValue({ count: 1 });
    const transaction = {
      membershipPrice: {
        create: jest.fn().mockResolvedValue({ id: "price-2", amount: { toString: () => "20000.00" }, effectiveFrom: new Date("2030-10-01T00:00:00.000Z"), createdAt: new Date("2030-09-01T00:00:00.000Z"), createdById: adminId }),
        findFirst: jest.fn().mockResolvedValue({ amount: { toString: () => "18000.00" } }),
      },
      user: { findMany: jest.fn().mockResolvedValue([{ id: memberId }]) },
      notification: { createMany: notificationCreateMany },
    };
    const database = { $transaction: (callback: (value: typeof transaction) => Promise<unknown>) => callback(transaction) } as unknown as PrismaClient;

    await new MembershipPriceRepository(database).createPrice({ amount: "20000", effectiveFrom: new Date("2030-10-01T00:00:00.000Z"), createdById: adminId });
    expect(transaction.user.findMany).toHaveBeenCalledWith({ where: { role: "MEMBER", status: "ACTIVE" }, select: { id: true } });
    expect(notificationCreateMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [expect.objectContaining({
        userId: memberId,
        type: "MEMBERSHIP_PRICE_CHANGED",
        // 2030-10-01T00:00Z is still 30 September at 21:00 in Buenos Aires.
        message: "La cuota mensual pasa a ser de $ 20.000,00 desde el 30/09/2030.",
      })],
    }));
  });

  test.each(["20000.00", "18000.00", "19999.99"])("CUO-06 does not notify when the new price is %s and the previous one is 20000.00", async (amount) => {
    const notificationCreateMany = jest.fn();
    const transaction = {
      membershipPrice: {
        create: jest.fn().mockResolvedValue({ id: "price-2", amount: { toString: () => amount }, effectiveFrom: new Date("2030-10-01T00:00:00.000Z"), createdAt: new Date(), createdById: adminId }),
        findFirst: jest.fn().mockResolvedValue({ amount: { toString: () => "20000.00" } }),
      },
      user: { findMany: jest.fn() },
      notification: { createMany: notificationCreateMany },
    };
    const database = { $transaction: (callback: (value: typeof transaction) => Promise<unknown>) => callback(transaction) } as unknown as PrismaClient;

    await new MembershipPriceRepository(database).createPrice({ amount, effectiveFrom: new Date("2030-10-01T00:00:00.000Z"), createdById: adminId });
    expect(transaction.user.findMany).not.toHaveBeenCalled();
    expect(notificationCreateMany).not.toHaveBeenCalled();
  });

  test("CUO-06 does not notify for the very first price", async () => {
    const notificationCreateMany = jest.fn();
    const transaction = {
      membershipPrice: {
        create: jest.fn().mockResolvedValue({ id: "price-1", amount: { toString: () => "20000.00" }, effectiveFrom: new Date("2030-10-01T00:00:00.000Z"), createdAt: new Date(), createdById: adminId }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      user: { findMany: jest.fn() },
      notification: { createMany: notificationCreateMany },
    };
    const database = { $transaction: (callback: (value: typeof transaction) => Promise<unknown>) => callback(transaction) } as unknown as PrismaClient;

    await new MembershipPriceRepository(database).createPrice({ amount: "20000", effectiveFrom: new Date("2030-10-01T00:00:00.000Z"), createdById: adminId });
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
    const notificationCreateMany = jest.fn().mockResolvedValue({ count: 2 });
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
      user: { findMany: jest.fn().mockResolvedValue([{ id: memberId }, { id: "trainer-id" }]) },
      notification: { createMany: notificationCreateMany },
    };
    const database = { $transaction: (callback: (value: typeof transaction) => Promise<unknown>) => callback(transaction) } as unknown as PrismaClient;

    await new EventRepository(database).updateStatus(event.id, { status: "CANCELLED" });
    expect(transaction.$queryRaw).toHaveBeenCalledTimes(1);
    expect(transaction.user.findMany).toHaveBeenCalledWith({ where: { role: { in: ["MEMBER", "TRAINER"] }, status: "ACTIVE" }, select: { id: true } });
    expect(notificationCreateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([
        expect.objectContaining({
          userId: memberId,
          type: "EVENT_CANCELLED",
          dedupeKey: expect.stringContaining(event.id),
          message: 'Se canceló el evento "Torneo" previsto para el 01/10/2030 a las 09:00.',
        }),
        expect.objectContaining({ userId: "trainer-id", type: "EVENT_CANCELLED" }),
      ]),
    }));
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
      notification: { createMany: notificationCreateMany },
    };
    const database = { $transaction: (callback: (value: typeof transaction) => Promise<unknown>) => callback(transaction) } as unknown as PrismaClient;

    await new EventRepository(database).updateStatus(event.id, { status: "CANCELLED" });
    expect(transaction.user.findMany).not.toHaveBeenCalled();
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
