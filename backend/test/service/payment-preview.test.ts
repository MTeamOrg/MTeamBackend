import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { Prisma } from "../../src/generated/prisma/client.js";
import { calculatePaymentExpiresAt } from "../../src/model/payment-expiration.js";
import { MembershipPriceRepository } from "../../src/repository/membership-price-repository.js";
import { PaymentPreviewRepository } from "../../src/repository/payment-preview-repository.js";
import { PaymentRepository } from "../../src/repository/payment-repository.js";
import { PaymentPreviewService } from "../../src/service/payment-preview-service.js";

const now = new Date("2026-09-25T12:00:00.000Z");
const memberId = "83cd902e-0475-4c92-943c-129b751dacee";
const administratorId = "212a6da6-063c-44c9-b63c-1d67602cb487";
const input = { memberId, amount: 20000.25, method: "transferencia", receiptNumber: "REC-1" };
const member = { id: memberId, firstName: "Lara", lastName: "Frenkel",
  documentNumber: "12345678", email: "lara@example.com", role: "MEMBER" };

function setup(memberResult: typeof member | null = member, priceResult: { amount: Prisma.Decimal } | null = {
  amount: new Prisma.Decimal("18000.00"),
}) {
  const findUnique = jest.fn().mockResolvedValue(memberResult);
  const findFirst = jest.fn().mockResolvedValue(priceResult);
  const create = jest.fn();
  const updateMany = jest.fn();
  const transaction = jest.fn();
  const database = {
    user: { findUnique }, membershipPrice: { findFirst },
    payment: { create, updateMany }, $transaction: transaction,
  } as unknown as PrismaClient;
  const service = new PaymentPreviewService(
    new PaymentPreviewRepository(database), new MembershipPriceRepository(database));
  return { service, findUnique, findFirst, create, updateMany, transaction };
}

describe("payment preview", () => {
  test("selects only a price already effective and allows a different entered amount without writes", async () => {
    const { service, findUnique, findFirst, create, updateMany, transaction } = setup();
    const preview = await service.previewPayment(input, now);

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: memberId },
      select: { id: true, firstName: true, lastName: true,
        documentNumber: true, email: true, role: true },
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: { effectiveFrom: { lte: now } },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    });
    expect(preview).toEqual({
      member: { id: memberId, firstName: "Lara", lastName: "Frenkel",
        documentNumber: "12345678", email: "lara@example.com" },
      currentPrice: "18000", amount: "20000.25", method: "transferencia",
      receiptNumber: "REC-1",
      estimatedAccreditedAt: now,
      estimatedExpiresAt: new Date("2026-10-25T12:00:00.000Z"),
    });
    expect(create).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  test("returns a null receipt number when none was provided", async () => {
    const { service } = setup();
    const preview = await service.previewPayment({ memberId, amount: 18000, method: "efectivo" }, now);
    expect(preview.receiptNumber).toBeNull();
  });

  test.each([
    [null, { amount: new Prisma.Decimal("18000") }, 404, "NOT_FOUND"],
    [{ ...member, role: "TRAINER" }, { amount: new Prisma.Decimal("18000") }, 400, "VALIDATION_ERROR"],
    [member, null, 404, "NOT_FOUND"],
  ])("rejects a missing member, non-member or missing current price", async (memberResult, priceResult,
    statusCode, code) => {
    const { service, create } = setup(memberResult, priceResult);
    await expect(service.previewPayment(input, now)).rejects.toMatchObject({ statusCode, code });
    expect(create).not.toHaveBeenCalled();
  });

  test("accrediting later recalculates the actual expiry from its own time", async () => {
    const preview = await setup().service.previewPayment(input, now);
    const actualAccreditation = new Date(now.getTime() + 60_000);
    jest.useFakeTimers().setSystemTime(actualAccreditation);
    try {
      const create = jest.fn().mockResolvedValue({ id: "payment-1" });
      const transaction = {
        user: { findUnique: jest.fn().mockResolvedValue({ role: "MEMBER" }) },
        payment: { create },
      };
      const database = { $transaction: (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction) } as unknown as PrismaClient;
      await new PaymentRepository(database).createAccreditedPayment(input, administratorId);

      expect(preview.estimatedExpiresAt).toEqual(calculatePaymentExpiresAt(now));
      expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({
        accreditedAt: actualAccreditation,
        expiresAt: calculatePaymentExpiresAt(actualAccreditation),
      }) });
      expect(calculatePaymentExpiresAt(actualAccreditation).getTime()
        - preview.estimatedExpiresAt.getTime()).toBe(60_000);
    } finally {
      jest.useRealTimers();
    }
  });
});
