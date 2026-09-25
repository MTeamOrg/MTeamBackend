import type { PrismaClient } from "../../src/generated/prisma/client.js";
import {
  MemberNotFoundError,
  PaymentRepository,
  UserIsNotMemberError,
} from "../../src/repository/payment-repository.js";

const memberId = "f846bcd2-c43f-4c08-a523-515b60b1c8a8";
const administratorId = "75f219ab-e396-40e5-b4cc-af0c516d3345";
const now = new Date("2026-09-25T15:45:12.345Z");

function setup(user: { role: string } | null) {
  const findUnique = jest.fn().mockResolvedValue(user);
  const create = jest.fn().mockImplementation(({ data }) => Promise.resolve({
    id: "c4e112b7-d043-454f-adc5-21ec1427eef8",
    ...data,
  }));
  const transaction = { user: { findUnique }, payment: { create } };
  const database = {
    $transaction: jest.fn().mockImplementation(
      (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    ),
  } as unknown as PrismaClient;
  return { repository: new PaymentRepository(database), database, findUnique, create };
}

describe("atomic payment accreditation", () => {
  test("validates the member and writes the 30-day payment in one transaction", async () => {
    jest.useFakeTimers().setSystemTime(now);
    try {
      const { repository, database, findUnique, create } = setup({ role: "MEMBER" });
      const result = await repository.createAccreditedPayment({
        memberId,
        amount: 12345.67,
        method: "TRANSFER",
        receiptNumber: "TEST-RECEIPT",
      }, administratorId);

      expect(database.$transaction).toHaveBeenCalledTimes(1);
      expect(findUnique).toHaveBeenCalledWith({ where: { id: memberId }, select: { role: true } });
      expect(create).toHaveBeenCalledWith({ data: {
        memberId,
        amount: "12345.67",
        method: "TRANSFER",
        receiptNumber: "TEST-RECEIPT",
        status: "ACCREDITED",
        createdById: administratorId,
        confirmedById: administratorId,
        accreditedAt: now,
        expiresAt: new Date("2026-10-25T15:45:12.345Z"),
      } });
      expect(result).toMatchObject({ amount: "12345.67", status: "ACCREDITED" });
    } finally {
      jest.useRealTimers();
    }
  });

  test("does not write when the user is missing or is not a member", async () => {
    const missing = setup(null);
    await expect(missing.repository.createAccreditedPayment({
      memberId, amount: 10, method: "CASH",
    }, administratorId)).rejects.toBeInstanceOf(MemberNotFoundError);
    expect(missing.create).not.toHaveBeenCalled();

    const trainer = setup({ role: "TRAINER" });
    await expect(trainer.repository.createAccreditedPayment({
      memberId, amount: 10, method: "CASH",
    }, administratorId)).rejects.toBeInstanceOf(UserIsNotMemberError);
    expect(trainer.create).not.toHaveBeenCalled();
  });
});
