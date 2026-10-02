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
    expect(notificationCreateMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [expect.objectContaining({ userId: memberId, type: "MEMBERSHIP_PRICE_CHANGED", message: expect.stringContaining("20000") })],
    }));
  });

  test("APM-06 notifies the member with the rejection observation", async () => {
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

    await repository.review(certificateId, adminId, { status: "REJECTED", reviewComment: "Falta firma" });
    expect(notificationCreateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ userId: memberId, type: "MEDICAL_CERTIFICATE_REVIEWED", message: expect.stringContaining("Falta firma") })],
    }));
  });

  test("cancelling an event keeps the record and notifies active members and trainers", async () => {
    const notificationCreateMany = jest.fn().mockResolvedValue({ count: 2 });
    const event = {
      id: "event-1", title: "Torneo", description: "D", startsAt: new Date("2030-10-01T12:00:00.000Z"),
      location: "Sede", imageUrl: "https://example.com/event.jpg", status: "PUBLISHED", createdById: adminId,
    };
    const transaction = {
      event: {
        findUnique: jest.fn().mockResolvedValue(event),
        update: jest.fn().mockResolvedValue({ ...event, status: "CANCELLED" }),
      },
      user: { findMany: jest.fn().mockResolvedValue([{ id: memberId }, { id: "trainer-id" }]) },
      notification: { createMany: notificationCreateMany },
    };
    const database = { $transaction: (callback: (value: typeof transaction) => Promise<unknown>) => callback(transaction) } as unknown as PrismaClient;

    await new EventRepository(database).updateStatus(event.id, { status: "CANCELLED" });
    expect(notificationCreateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([
        expect.objectContaining({ userId: memberId, type: "EVENT_CANCELLED", dedupeKey: expect.stringContaining(event.id) }),
        expect.objectContaining({ userId: "trainer-id", type: "EVENT_CANCELLED" }),
      ]),
    }));
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
