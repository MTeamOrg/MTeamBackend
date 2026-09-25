import type { PrismaClient } from "../../src/generated/prisma/client.js";
import {
  MemberMembershipRepository,
  type LastAccreditedPayment,
  type MemberMembershipRepositoryPort,
} from "../../src/repository/member-membership-repository.js";
import type { MembershipPriceRepositoryPort } from "../../src/repository/membership-price-repository.js";
import { PaymentRepository } from "../../src/repository/payment-repository.js";
import { MemberMembershipService } from "../../src/service/member-membership-service.js";

const now = new Date("2026-09-24T12:00:00.000Z");
const day = 24 * 60 * 60 * 1000;
const memberId = "83cd902e-0475-4c92-943c-129b751dacee";

function createService(payment: LastAccreditedPayment | null) {
  const membershipRepository: MemberMembershipRepositoryPort = {
    findLatestAccreditedPayment: jest.fn().mockResolvedValue(payment),
  };
  const priceRepository: Pick<MembershipPriceRepositoryPort, "findCurrentPrice"> = {
    findCurrentPrice: jest.fn().mockResolvedValue({ amount: { toString: () => "18000.00" } }),
  };
  return { service: new MemberMembershipService(membershipRepository, priceRepository), membershipRepository, priceRepository };
}

describe("own membership status", () => {
  test("no valid payment is expired, even when a current price exists", async () => {
    const { service, membershipRepository, priceRepository } = createService(null);

    expect(await service.getOwnMembership(memberId, now)).toEqual({
      currentPrice: "18000.00",
      lastPaymentAt: null,
      expiresAt: null,
      daysRemaining: 0,
      status: "EXPIRED",
    });
    expect(membershipRepository.findLatestAccreditedPayment).toHaveBeenCalledWith(memberId, now);
    expect(priceRepository.findCurrentPrice).toHaveBeenCalledWith(now);
  });

  test.each([
    [5 * day + 1, "CURRENT", 6],
    [5 * day, "EXPIRING_SOON", 5],
    [1, "EXPIRING_SOON", 1],
    [0, "EXPIRED", 0],
    [-1, "EXPIRED", 0],
  ] as const)("classifies %i ms until expiration as %s", async (remaining, status, daysRemaining) => {
    const expiresAt = new Date(now.getTime() + remaining);
    const accreditedAt = new Date(expiresAt.getTime() - 30 * day);
    const { service } = createService({ id: "payment-1", accreditedAt, expiresAt });

    expect(await service.getOwnMembership(memberId, now)).toEqual({
      currentPrice: "18000.00",
      lastPaymentAt: accreditedAt,
      expiresAt,
      daysRemaining,
      status,
    });
  });

  test("a missing current price stays null without changing payment status", async () => {
    const { service, priceRepository } = createService({
      id: "payment-1",
      accreditedAt: new Date(now.getTime() - 2 * day),
      expiresAt: new Date(now.getTime() + 28 * day),
    });
    (priceRepository.findCurrentPrice as jest.Mock).mockResolvedValue(null);

    const result = await service.getOwnMembership(memberId, now);
    expect(result.currentPrice).toBeNull();
    expect(result.status).toBe("CURRENT");
  });

  test("the payment lookup excludes voided and future payments and selects the latest valid one", async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const repository = new MemberMembershipRepository({ payment: { findFirst } } as unknown as PrismaClient);

    await repository.findLatestAccreditedPayment(memberId, now);

    expect(findFirst).toHaveBeenCalledWith({
      where: { memberId, status: "ACCREDITED", accreditedAt: { lte: now } },
      orderBy: [{ accreditedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      select: { id: true, accreditedAt: true, expiresAt: true },
    });
  });

  test("a newly accredited payment starts exactly 30 days of validity without carryover", async () => {
    jest.useFakeTimers().setSystemTime(now);
    try {
      const create = jest.fn().mockResolvedValue({ id: "payment-2" });
      const transaction = {
        user: { findUnique: jest.fn().mockResolvedValue({ role: "MEMBER" }) },
        payment: { create },
      };
      const database = {
        $transaction: (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction),
      } as unknown as PrismaClient;

      await new PaymentRepository(database).createAccreditedPayment(
        { memberId, amount: 18000, method: "cash" },
        "administrator-1",
      );

      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          memberId,
          status: "ACCREDITED",
          accreditedAt: now,
          expiresAt: new Date(now.getTime() + 30 * day),
        }),
      });
    } finally {
      jest.useRealTimers();
    }
  });
});
