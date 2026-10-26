import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { calculateInitialMedicalCertificatePeriod } from "../../src/model/initial-medical-certificate-period.js";
import { MemberMembershipRepository } from "../../src/repository/member-membership-repository.js";
import { MemberMembershipService } from "../../src/service/member-membership-service.js";

const now = new Date("2026-09-24T12:00:00.000Z");
const day = 24 * 60 * 60 * 1000;
const memberId = "83cd902e-0475-4c92-943c-129b751dacee";

describe("initial 20-day medical certificate period after a void", () => {
  test("membership falls back to the latest remaining accredited payment", async () => {
    const priorPaymentAt = new Date(now.getTime() - 29 * day);
    const priorExpiresAt = new Date(priorPaymentAt.getTime() + 30 * day);
    const findFirst = jest.fn().mockResolvedValue({
      id: "prior", accreditedAt: priorPaymentAt, expiresAt: priorExpiresAt,
    });
    const repository = new MemberMembershipRepository({ payment: { findFirst } } as unknown as PrismaClient);
    const service = new MemberMembershipService(repository, {
      findCurrentPrice: jest.fn().mockResolvedValue(null),
    });

    expect(await service.getOwnMembership(memberId, now)).toMatchObject({
      lastPaymentAt: priorPaymentAt, expiresAt: priorExpiresAt,
      daysRemaining: 1, status: "EXPIRING_SOON",
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: { memberId, status: "ACCREDITED", accreditedAt: { lte: now } },
      orderBy: [{ accreditedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      select: { id: true, accreditedAt: true, expiresAt: true },
    });
  });

  test.each([
    [null, false, 0],
    [new Date(now.getTime() - 20 * day + 1), true, 1],
    [new Date(now.getTime() - 20 * day), false, 0],
    [new Date(now.getTime() - 20 * day - 1), false, 0],
    [new Date(now.getTime() + 1), false, 0],
  ] as const)("handles first payment at %p", (firstPaymentAt, isActive, daysRemaining) => {
    expect(calculateInitialMedicalCertificatePeriod(firstPaymentAt, now))
      .toMatchObject({ isActive, daysRemaining });
  });

  test("finds the oldest remaining accredited payment, excluding voided and future payments", async () => {
    const secondPaymentAt = new Date("2026-09-10T12:00:00.000Z");
    const findFirst = jest.fn().mockResolvedValue({
      id: "second", accreditedAt: secondPaymentAt,
      expiresAt: new Date(secondPaymentAt.getTime() + 30 * day),
    });
    const repository = new MemberMembershipRepository({ payment: { findFirst } } as unknown as PrismaClient);
    const firstRemaining = await repository.findEarliestAccreditedPayment(memberId, now);

    expect(findFirst).toHaveBeenCalledWith({
      where: { memberId, status: "ACCREDITED", accreditedAt: { lte: now } },
      orderBy: [{ accreditedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: { id: true, accreditedAt: true, expiresAt: true },
    });
    expect(calculateInitialMedicalCertificatePeriod(firstRemaining!.accreditedAt, now))
      .toMatchObject({ startsAt: secondPaymentAt, isActive: true, daysRemaining: 6 });
  });

  test("has no initial period when no valid payments remain", async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const repository = new MemberMembershipRepository({ payment: { findFirst } } as unknown as PrismaClient);
    const firstRemaining = await repository.findEarliestAccreditedPayment(memberId, now);
    expect(calculateInitialMedicalCertificatePeriod(firstRemaining?.accreditedAt ?? null, now))
      .toEqual({ startsAt: null, expiresAt: null, daysRemaining: 0, isActive: false });
  });
});
