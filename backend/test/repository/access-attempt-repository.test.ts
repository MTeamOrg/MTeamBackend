import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { AccessAttemptRepository } from "../../src/repository/access-attempt-repository.js";
import { listAccessAttemptsSchema } from "../../src/validator/access-attempt-validator.js";

const actor = { id: "212a6da6-063c-44c9-b63c-1d67602cb487", role: "MEMBER", status: "ACTIVE" };
const accessPoint = { id: "point-id", name: "Puerta", branch: { id: "branch-id" } };
const payment = { expiresAt: new Date("2026-11-01T00:00:00.000Z") };
const attempt = { id: "attempt-id", userId: "member-id", result: "ALLOWED" };

function setup() {
  const userFindUnique = jest.fn().mockResolvedValue(actor);
  const accessPointFindUnique = jest.fn().mockResolvedValue(accessPoint);
  const paymentFindFirst = jest.fn().mockResolvedValue(payment);
  const certificateFindFirst = jest.fn().mockResolvedValue({ id: "certificate-id" });
  const accessLogCreate = jest.fn().mockResolvedValue(attempt);
  const accessLogCount = jest.fn().mockResolvedValue(1);
  const accessLogFindMany = jest.fn().mockResolvedValue([attempt]);
  const database = {
    user: { findUnique: userFindUnique },
    accessPoint: { findUnique: accessPointFindUnique },
    payment: { findFirst: paymentFindFirst },
    medicalCertificate: { findFirst: certificateFindFirst },
    accessLog: { create: accessLogCreate, count: accessLogCount, findMany: accessLogFindMany },
    $transaction: jest.fn().mockResolvedValue([1, [attempt]]),
  } as unknown as PrismaClient;
  return {
    repository: new AccessAttemptRepository(database), userFindUnique, accessPointFindUnique,
    paymentFindFirst, certificateFindFirst, accessLogCreate, accessLogCount, accessLogFindMany,
    transaction: database.$transaction as jest.Mock,
  };
}

describe("access attempt repository", () => {
  test("looks up the actor and QR point with their required data", async () => {
    const state = setup();
    await expect(state.repository.findActor("member-id")).resolves.toEqual(actor);
    await expect(state.repository.findAccessPoint("qr-token")).resolves.toEqual(accessPoint);
    expect(state.userFindUnique).toHaveBeenCalledWith({ where: { id: "member-id" }, select: {
      id: true, role: true, status: true,
    } });
    expect(state.accessPointFindUnique).toHaveBeenCalledWith({ where: { qrToken: "qr-token" }, include: { branch: true } });
  });

  test("queries the latest and earliest qualifying payments and approved medical certificate", async () => {
    const state = setup();
    const now = new Date("2026-10-22T12:00:00.000Z");
    await state.repository.findMembership("member-id", now);
    await state.repository.findFirstAccreditedPayment("member-id", now);
    await state.repository.findApprovedMedicalCertificate("member-id");
    expect(state.paymentFindFirst).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { memberId: "member-id", status: "ACCREDITED", accreditedAt: { lte: now } },
      orderBy: [{ accreditedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    }));
    expect(state.paymentFindFirst).toHaveBeenNthCalledWith(2, expect.objectContaining({
      orderBy: [{ accreditedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    }));
    expect(state.certificateFindFirst).toHaveBeenCalledWith({ where: { memberId: "member-id", status: "APPROVED" }, select: { id: true } });
  });

  test("persists an access result and returns the paginated filtered list", async () => {
    const state = setup();
    const attemptedAt = new Date("2026-10-22T12:00:00.000Z");
    await expect(state.repository.create({ userId: "member-id", roleAtAttempt: "MEMBER", branchId: "branch-id",
      accessPointId: "point-id", result: "DENIED", denialReason: "EXPIRED_MEMBERSHIP", attemptedAt }))
      .resolves.toEqual(attempt);
    const userId = "212a6da6-063c-44c9-b63c-1d67602cb487";
    const branchId = "abcfcc68-3c9f-4dd3-b50a-65948d1a6adc";
    const query = listAccessAttemptsSchema.parse({ page: "2", limit: "5", userId, search: " Ana ",
      branchId, role: "MEMBER", result: "DENIED", from: "2026-10-01T00:00:00Z", to: "2026-10-22T23:59:59Z" });
    await expect(state.repository.list(query)).resolves.toEqual({ items: [attempt], page: 2, limit: 5, total: 1 });
    expect(state.accessLogCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ result: "DENIED", denialReason: "EXPIRED_MEMBERSHIP" }) }));
    const where = expect.objectContaining({ userId, branchId, roleAtAttempt: "MEMBER",
      result: "DENIED", attemptedAt: { gte: new Date("2026-10-01T00:00:00Z"), lte: new Date("2026-10-22T23:59:59Z") },
      user: { OR: expect.arrayContaining([{ firstName: { contains: "Ana", mode: "insensitive" } }]) },
    });
    expect(state.accessLogCount).toHaveBeenCalledWith({ where });
    expect(state.accessLogFindMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: 5, take: 5 }));
    expect(state.transaction).toHaveBeenCalledTimes(1);
  });

  test("lists without optional filters", async () => {
    const state = setup();
    const query = listAccessAttemptsSchema.parse({});
    await state.repository.list(query);
    expect(state.accessLogFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: {}, skip: 0, take: 20 }));
  });
});
