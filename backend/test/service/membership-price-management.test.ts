import type { MembershipPrice, PrismaClient } from "../../src/generated/prisma/client.js";
import { MembershipPriceRepository, type MembershipPriceRepositoryPort } from "../../src/repository/membership-price-repository.js";
import { MembershipPriceService } from "../../src/service/membership-price-service.js";
import { createMembershipPriceSchema } from "../../src/validator/membership-price-validator.js";

const administratorId = "a69a0192-a9a9-4936-8c79-bc5ff13d8dc2";
const now = new Date("2026-09-24T12:00:00.000Z");

function price(id: string, amount: string, effectiveFrom: string, createdAt: string) {
  return {
    id,
    amount: { toString: () => amount },
    effectiveFrom: new Date(effectiveFrom),
    createdAt: new Date(createdAt),
    createdById: administratorId,
  } as unknown as MembershipPrice;
}

describe("membership price management", () => {
  test("accepts a scheduled price and retains its administrator and effective date", async () => {
    const futureEffectiveFrom = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const created = price("30000000-0000-0000-0000-000000000003", "20000.00", futureEffectiveFrom, "2026-09-24T12:00:00.000Z");
    const createPrice = jest.fn().mockResolvedValue({ ...created, previousAmount: "18000.00" });
    const repository = { createPrice } as unknown as MembershipPriceRepositoryPort;
    const service = new MembershipPriceService(repository);
    const input = { amount: 20000, effectiveFrom: futureEffectiveFrom };

    expect(createMembershipPriceSchema.safeParse(input).success).toBe(true);
    expect(await service.createPrice(input, administratorId)).toEqual({ ...created, previousAmount: "18000.00" });
    expect(createPrice).toHaveBeenCalledWith({
      amount: "20000",
      effectiveFrom: new Date(input.effectiveFrom),
      createdById: administratorId,
    });
  });

  test("inserts a new row and derives the previous amount from earlier effective records", async () => {
    const created = price("30000000-0000-0000-0000-000000000003", "20000.00", "2026-10-01T00:00:00.000Z", "2026-09-24T12:00:00.000Z");
    const create = jest.fn().mockResolvedValue(created);
    const findFirst = jest.fn().mockResolvedValue({ amount: { toString: () => "18000.00" } });
    const transaction = { membershipPrice: { create, findFirst } };
    const database = {
      $transaction: (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction),
    } as unknown as PrismaClient;

    const result = await new MembershipPriceRepository(database).createPrice({
      amount: "20000",
      effectiveFrom: created.effectiveFrom,
      createdById: administratorId,
    });

    expect(result.previousAmount).toBe("18000.00");
    expect(create).toHaveBeenCalledWith({
      data: { amount: "20000", effectiveFrom: created.effectiveFrom, createdById: administratorId },
    });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: [
        { effectiveFrom: { lt: created.effectiveFrom } },
        { effectiveFrom: created.effectiveFrom, createdAt: { lt: created.createdAt } },
        { effectiveFrom: created.effectiveFrom, createdAt: created.createdAt, id: { lt: created.id } },
      ] },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      select: { amount: true },
    }));
  });

  test("the first price has no previous amount", async () => {
    const created = price("10000000-0000-0000-0000-000000000001", "18000.00", "2026-09-01T00:00:00.000Z", "2026-09-01T00:00:00.000Z");
    const transaction = { membershipPrice: {
      create: jest.fn().mockResolvedValue(created),
      findFirst: jest.fn().mockResolvedValue(null),
    } };
    const database = {
      $transaction: (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction),
    } as unknown as PrismaClient;

    const result = await new MembershipPriceRepository(database).createPrice({
      amount: "18000",
      effectiveFrom: created.effectiveFrom,
      createdById: administratorId,
    });

    expect(result.previousAmount).toBeNull();
  });

  test("the current price excludes future effective dates", async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const database = { membershipPrice: { findFirst } } as unknown as PrismaClient;

    await new MembershipPriceRepository(database).findCurrentPrice(now);

    expect(findFirst).toHaveBeenCalledWith({
      where: { effectiveFrom: { lte: now } },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    });
  });

  test("the history includes the older value across page boundaries", async () => {
    const middle = price("20000000-0000-0000-0000-000000000002", "20000.00", "2026-09-15T00:00:00.000Z", "2026-09-15T00:00:00.000Z");
    const oldest = price("10000000-0000-0000-0000-000000000001", "18000.00", "2026-09-01T00:00:00.000Z", "2026-09-01T00:00:00.000Z");
    const count = jest.fn().mockResolvedValue(3);
    const findMany = jest.fn().mockResolvedValue([middle, oldest]);
    const database = {
      membershipPrice: { count, findMany },
      $transaction: (requests: Promise<unknown>[]) => Promise.all(requests),
    } as unknown as PrismaClient;

    const history = await new MembershipPriceRepository(database).listPrices({ page: 2, limit: 1 });

    expect(history).toEqual({
      items: [{ ...middle, previousAmount: "18000.00" }],
      page: 2,
      limit: 1,
      total: 3,
    });
    expect(findMany).toHaveBeenCalledWith({
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      skip: 1,
      take: 2,
    });
  });
});
