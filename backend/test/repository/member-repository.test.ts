import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { MemberRepository } from "../../src/repository/member-repository.js";

const now = new Date("2026-09-24T12:00:00.000Z");
const soonBoundary = new Date("2026-09-29T12:00:00.000Z");

function setup(users: unknown[] = []) {
  const count = jest.fn().mockReturnValue(Promise.resolve(7));
  const findMany = jest.fn().mockReturnValue(Promise.resolve(users));
  const transaction = jest.fn().mockImplementation(async (operations: Promise<unknown>[]) =>
    Promise.all(operations));
  const repository = new MemberRepository({
    user: { count, findMany }, $transaction: transaction,
  } as unknown as PrismaClient);
  return { repository, count, findMany, transaction };
}

describe("member membership filters", () => {
  test.each([
    ["CURRENT", { memberPayments: { some: {
      status: "ACCREDITED", accreditedAt: { lte: now }, expiresAt: { gt: soonBoundary },
    } } }],
    ["EXPIRING_SOON", { AND: [
      { memberPayments: { some: {
        status: "ACCREDITED", accreditedAt: { lte: now }, expiresAt: { gt: now },
      } } },
      { memberPayments: { none: {
        status: "ACCREDITED", accreditedAt: { lte: now }, expiresAt: { gt: soonBoundary },
      } } },
    ] }],
    ["EXPIRED", { memberPayments: { none: {
      status: "ACCREDITED", accreditedAt: { lte: now }, expiresAt: { gt: now },
    } } }],
  ] as const)("filters %s in the database before pagination", async (membershipStatus, expected) => {
    const { repository, count, findMany } = setup();
    const result = await repository.listMembers({ membershipStatus, page: 2, limit: 3,
      search: " lara ".trim() }, now);
    const where = expect.objectContaining({ role: "MEMBER", ...expected,
      OR: expect.arrayContaining([
        { firstName: { contains: "lara", mode: "insensitive" } },
        { documentNumber: { contains: "lara", mode: "insensitive" } },
      ]),
    });
    expect(count).toHaveBeenCalledWith({ where });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where, skip: 3, take: 3,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
    }));
    expect(result).toEqual({ items: [], page: 2, limit: 3, total: 7 });
  });

  test("loads one latest valid payment per returned member without individual queries", async () => {
    const { repository, findMany, transaction } = setup([
      { id: "1", firstName: "A", lastName: "A", documentNumber: "1", email: "a@x.com",
        status: "INACTIVE", memberPayments: [{
          accreditedAt: new Date("2026-08-30T12:00:00.000Z"), expiresAt: soonBoundary,
        }] },
      { id: "2", firstName: "B", lastName: "B", documentNumber: "2", email: "b@x.com",
        status: "ACTIVE", memberPayments: [] },
    ]);
    const result = await repository.listMembers({ page: 1, limit: 20 }, now);

    expect(result.items.map((item) => item.membershipStatus)).toEqual(["EXPIRING_SOON", "EXPIRED"]);
    expect(result.items[0]?.status).toBe("INACTIVE");
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({
      memberPayments: {
        where: { status: "ACCREDITED", accreditedAt: { lte: now } },
        orderBy: [{ accreditedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        take: 1, select: { accreditedAt: true, expiresAt: true },
      },
    }) }));
  });

  test.each([
    [5 * 24 * 60 * 60 * 1000 + 1, "CURRENT"],
    [5 * 24 * 60 * 60 * 1000, "EXPIRING_SOON"],
    [1, "EXPIRING_SOON"],
    [0, "EXPIRED"],
    [-1, "EXPIRED"],
  ] as const)("classifies %i ms to expiry as %s", async (remaining, expected) => {
    const expiresAt = new Date(now.getTime() + remaining);
    const { repository } = setup([{
      id: "1", firstName: "A", lastName: "A", documentNumber: "1", email: "a@x.com",
      status: "ACTIVE", memberPayments: [{
        accreditedAt: new Date(expiresAt.getTime() - 30 * 24 * 60 * 60 * 1000), expiresAt,
      }],
    }]);
    const result = await repository.listMembers({ page: 1, limit: 20 }, now);
    expect(result.items[0]?.membershipStatus).toBe(expected);
  });
});
