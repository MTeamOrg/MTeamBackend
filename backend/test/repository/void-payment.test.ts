import type { PrismaClient } from "../../src/generated/prisma/client.js";
import {
  PaymentAlreadyVoidedError, PaymentNotFoundError, PaymentRepository,
} from "../../src/repository/payment-repository.js";
import { PaymentService } from "../../src/service/payment-service.js";

const paymentId = "83cd902e-0475-4c92-943c-129b751dacee";
const administratorId = "212a6da6-063c-44c9-b63c-1d67602cb487";
const now = new Date("2026-09-24T12:00:00.000Z");

function setup(count: number, existing: { id: string } | null = { id: paymentId }) {
  const payment = { id: paymentId, status: "VOIDED", voidReason: "Pago duplicado" };
  const updateMany = jest.fn().mockResolvedValue({ count });
  const findUnique = jest.fn().mockResolvedValue(existing);
  const findUniqueOrThrow = jest.fn().mockResolvedValue(payment);
  const transaction = { payment: { updateMany, findUnique, findUniqueOrThrow } };
  const database = { $transaction: jest.fn().mockImplementation(
    (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction),
  ) } as unknown as PrismaClient;
  return { repository: new PaymentRepository(database), updateMany, findUnique,
    findUniqueOrThrow, database };
}

describe("atomic payment void", () => {
  test("updates only an accredited payment and preserves original fields", async () => {
    jest.useFakeTimers().setSystemTime(now);
    try {
      const { repository, updateMany, findUniqueOrThrow, database } = setup(1);
      const result = await repository.voidAccreditedPayment(paymentId, "Pago duplicado", administratorId);

      expect(database.$transaction).toHaveBeenCalledTimes(1);
      expect(updateMany).toHaveBeenCalledWith({
        where: { id: paymentId, status: "ACCREDITED" },
        data: { status: "VOIDED", voidReason: "Pago duplicado",
          voidedById: administratorId, voidedAt: now },
      });
      expect(findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: paymentId } });
      expect(result.status).toBe("VOIDED");
    } finally {
      jest.useRealTimers();
    }
  });

  test("distinguishes a missing payment from one already voided", async () => {
    await expect(setup(0, null).repository.voidAccreditedPayment(paymentId, "Error", administratorId))
      .rejects.toBeInstanceOf(PaymentNotFoundError);
    await expect(setup(0).repository.voidAccreditedPayment(paymentId, "Error", administratorId))
      .rejects.toBeInstanceOf(PaymentAlreadyVoidedError);
  });

  test("two requests cannot both void the same accredited payment", async () => {
    const { repository, updateMany } = setup(1);
    updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const results = await Promise.allSettled([
      repository.voidAccreditedPayment(paymentId, "Error", administratorId),
      repository.voidAccreditedPayment(paymentId, "Error", administratorId),
    ]);
    expect(results[0].status).toBe("fulfilled");
    expect(results[1]).toMatchObject({ status: "rejected", reason: expect.any(PaymentAlreadyVoidedError) });
    expect(updateMany).toHaveBeenCalledTimes(2);
  });

  test("service returns clear 404 and 409 errors", async () => {
    for (const [count, existing, statusCode, code] of [
      [0, null, 404, "NOT_FOUND"], [0, { id: paymentId }, 409, "CONFLICT"],
    ] as const) {
      const service = new PaymentService(setup(count, existing).repository);
      await expect(service.voidPayment(paymentId, "Error", administratorId))
        .rejects.toMatchObject({ statusCode, code });
    }
  });
});
