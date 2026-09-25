import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { BranchRepository } from "../../src/repository/branch-repository.js";

const branchId = "83cd902e-0475-4c92-943c-129b751dacee";

function setup(items: unknown[] = [], total = 0, detail: unknown = null) {
  const count = jest.fn().mockResolvedValue(total);
  const findMany = jest.fn().mockResolvedValue(items);
  const findFirst = jest.fn().mockResolvedValue(detail);
  const transaction = jest.fn().mockImplementation((operations: Promise<unknown>[]) =>
    Promise.all(operations));
  const database = {
    branch: { count, findMany, findFirst }, $transaction: transaction,
  } as unknown as PrismaClient;
  return { repository: new BranchRepository(database), count, findMany, findFirst, transaction };
}

describe("public branch queries", () => {
  test("filters active branches and search before counting and paginating", async () => {
    const items = [{ id: branchId, name: "Sede Centro" }];
    const { repository, count, findMany, transaction } = setup(items, 3);
    expect(await repository.listPublicBranches({ search: "centro", page: 2, limit: 1 }))
      .toEqual({ items, page: 2, limit: 1, total: 3 });
    const where = {
      isActive: true,
      OR: [
        { name: { contains: "centro", mode: "insensitive" } },
        { address: { contains: "centro", mode: "insensitive" } },
        { description: { contains: "centro", mode: "insensitive" } },
      ],
    };
    expect(count).toHaveBeenCalledWith({ where });
    expect(findMany).toHaveBeenCalledWith({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: 1,
      take: 1,
      select: {
        id: true, name: true, imageUrl: true, address: true,
        openingHours: true, phone: true, description: true,
      },
    });
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  test("excludes inactive branches without search and reports an empty page", async () => {
    const { repository, count, findMany } = setup();
    expect(await repository.listPublicBranches({ page: 1, limit: 20 }))
      .toEqual({ items: [], page: 1, limit: 20, total: 0 });
    expect(count).toHaveBeenCalledWith({ where: { isActive: true } });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true } }));
  });

  test("loads only an active branch with classes ordered by start time", async () => {
    const detail = { id: branchId, scheduledClasses: [] };
    const { repository, findFirst } = setup([], 0, detail);
    expect(await repository.findPublicBranchById(branchId)).toEqual(detail);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: branchId, isActive: true },
      select: {
        id: true, name: true, imageUrl: true, address: true,
        openingHours: true, phone: true, description: true,
        latitude: true, longitude: true,
        scheduledClasses: {
          orderBy: [{ startsAt: "asc" }, { id: "asc" }],
          select: {
            id: true, activity: true, startsAt: true,
            trainer: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
  });

  test("returns null when an active branch is not found", async () => {
    const { repository } = setup();
    expect(await repository.findPublicBranchById(branchId)).toBeNull();
  });
});
