import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { Prisma } from "../../src/generated/prisma/client.js";
import { PaymentRepository } from "../../src/repository/payment-repository.js";

const memberId = "83cd902e-0475-4c92-943c-129b751dacee";
const from = "2026-09-01T00:00:00.000Z";
const to = "2026-10-01T00:00:00.000Z";

function setup(items: unknown[] = [], total = 0,
  sum: Prisma.Decimal | null = new Prisma.Decimal("0"), count = 0) {
  const paymentCount = jest.fn().mockResolvedValue(total);
  const findMany = jest.fn().mockResolvedValue(items);
  const aggregate = jest.fn().mockResolvedValue({
    _count: { id: count }, _sum: { amount: sum },
  });
  const transaction = jest.fn().mockImplementation((operations: Promise<unknown>[]) =>
    Promise.all(operations));
  const database = {
    payment: { count: paymentCount, findMany, aggregate }, $transaction: transaction,
  } as unknown as PrismaClient;
  return { repository: new PaymentRepository(database), paymentCount, findMany, aggregate, transaction };
}

describe("PAG-04 filtered payment listing", () => {
  test("applies combined filters before pagination and counts the filtered results", async () => {
    const items = [{ id: "voided", status: "VOIDED" }];
    const { repository, paymentCount, findMany, transaction } = setup(items, 5);
    const result = await repository.listPayments({
      memberId, documentNumber: "1234", from, to, method: "transferencia",
      status: "VOIDED", page: 2, limit: 2,
    });
    const where = {
      memberId,
      member: { is: { documentNumber: { contains: "1234" } } },
      accreditedAt: { gte: new Date(from), lt: new Date(to) },
      method: "transferencia", status: "VOIDED",
    };
    expect(paymentCount).toHaveBeenCalledWith({ where });
    expect(findMany).toHaveBeenCalledWith({
      where,
      orderBy: [{ accreditedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      skip: 2, take: 2,
      select: {
        id: true, accreditedAt: true, amount: true, method: true,
        receiptNumber: true, status: true, expiresAt: true, voidedAt: true,
        voidReason: true,
        member: { select: { id: true, firstName: true, lastName: true,
          documentNumber: true, email: true } },
      },
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ items, page: 2, limit: 2, total: 5 });
  });

  test("includes accredited and voided payments by default with no filters", async () => {
    const items = [{ status: "VOIDED" }, { status: "ACCREDITED" }];
    const { repository, paymentCount, findMany } = setup(items, 2);
    const result = await repository.listPayments({ page: 1, limit: 20 });
    expect(paymentCount).toHaveBeenCalledWith({ where: {} });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    expect(result.items).toEqual(items);
    expect(result.total).toBe(2);
  });

  test.each([
    [{ from, page: 1, limit: 20 }, { gte: new Date(from) }],
    [{ to, page: 1, limit: 20 }, { lt: new Date(to) }],
  ] as const)("accepts a single date bound", async (query, range) => {
    const { repository, paymentCount } = setup();
    await repository.listPayments(query);
    expect(paymentCount).toHaveBeenCalledWith({ where: { accreditedAt: range } });
  });
});

describe("PAG-07 precise payment summary", () => {
  test("sums all accredited payments with inclusive from and exclusive to", async () => {
    const { repository, aggregate } = setup([], 0, new Prisma.Decimal("12345678901.23"), 3);
    expect(await repository.getPaymentsSummary({ from, to })).toEqual({
      from: new Date(from), to: new Date(to), paymentCount: 3,
      totalAmount: "12345678901.23",
    });
    expect(aggregate).toHaveBeenCalledWith({
      where: { status: "ACCREDITED", accreditedAt: { gte: new Date(from), lt: new Date(to) } },
      _count: { id: true }, _sum: { amount: true },
    });
  });

  test("returns zero for an empty range", async () => {
    const { repository } = setup([], 0, null, 0);
    expect(await repository.getPaymentsSummary({ from, to })).toMatchObject({
      paymentCount: 0, totalAmount: "0",
    });
  });
});
