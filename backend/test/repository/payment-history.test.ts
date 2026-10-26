import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { PaymentRepository } from "../../src/repository/payment-repository.js";
import { PaymentService } from "../../src/service/payment-service.js";

const memberId = "83cd902e-0475-4c92-943c-129b751dacee";

function setup(items: unknown[] = [], total = 0, memberExists = true) {
  const findFirst = jest.fn().mockResolvedValue(memberExists ? { id: memberId } : null);
  const count = jest.fn().mockResolvedValue(total);
  const findMany = jest.fn().mockResolvedValue(items);
  const transaction = jest.fn().mockImplementation((operations: Promise<unknown>[]) =>
    Promise.all(operations));
  const database = {
    user: { findFirst }, payment: { count, findMany }, $transaction: transaction,
  } as unknown as PrismaClient;
  return { repository: new PaymentRepository(database), findFirst, count, findMany, transaction };
}

describe("PAG-03 payment history repository", () => {
  test("checks that the requested user is a member", async () => {
    const { repository, findFirst } = setup();
    expect(await repository.isMember(memberId)).toBe(true);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: memberId, role: "MEMBER" }, select: { id: true },
    });
  });

  test("returns 404 for a missing or non-member target without reading payments", async () => {
    const { repository, findMany } = setup([], 0, false);
    const service = new PaymentService(repository);
    await expect(service.listMemberPayments(memberId, { page: 1, limit: 20 }))
      .rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
    expect(findMany).not.toHaveBeenCalled();
  });

  test("uses the same member filter for count and page, retaining voided payments", async () => {
    const items = [{ id: "voided", status: "VOIDED" }];
    const { repository, count, findMany, transaction } = setup(items, 3);
    const result = await repository.listMemberPayments(memberId, { page: 2, limit: 1 });

    expect(count).toHaveBeenCalledWith({ where: { memberId } });
    expect(findMany).toHaveBeenCalledWith({
      where: { memberId },
      orderBy: [{ accreditedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      skip: 1,
      take: 1,
      select: {
        id: true, accreditedAt: true, amount: true, method: true,
        receiptNumber: true, status: true, expiresAt: true,
        voidedAt: true, voidReason: true,
      },
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ items, page: 2, limit: 1, total: 3 });
  });

  test("returns an empty history with total zero", async () => {
    const { repository } = setup();
    expect(await repository.listMemberPayments(memberId, { page: 1, limit: 20 }))
      .toEqual({ items: [], page: 1, limit: 20, total: 0 });
  });
});
