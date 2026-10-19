import { Prisma, type PrismaClient } from "../../src/generated/prisma/client.js";
import { BranchNotFoundError, BranchRepository } from "../../src/repository/branch-repository.js";

const branchId = "83cd902e-0475-4c92-943c-129b751dacee";

function setup(items: unknown[] = [], total = 0, detail: unknown = null) {
  const count = jest.fn().mockResolvedValue(total);
  const findMany = jest.fn().mockResolvedValue(items);
  const findUnique = jest.fn().mockResolvedValue(detail);
  const update = jest.fn().mockResolvedValue({ id: branchId, isActive: false });
  const transaction = jest.fn().mockImplementation((operations: Promise<unknown>[]) =>
    Promise.all(operations));
  const database = {
    branch: { count, findMany, findUnique, update }, $transaction: transaction,
  } as unknown as PrismaClient;
  return { repository: new BranchRepository(database), count, findMany, findUnique, update,
    transaction };
}

describe("SED-06 administrative branch repository", () => {
  test("counts after combined search and inactive filter, before pagination", async () => {
    const items = [{ id: branchId, isActive: false }];
    const { repository, count, findMany, transaction } = setup(items, 4);
    expect(await repository.listAdminBranches({ search: "centro", isActive: false,
      page: 2, limit: 1 })).toEqual({ items, page: 2, limit: 1, total: 4 });
    const where = {
      OR: [
        { name: { contains: "centro", mode: "insensitive" } },
        { address: { contains: "centro", mode: "insensitive" } },
        { description: { contains: "centro", mode: "insensitive" } },
      ],
      isActive: false,
    };
    expect(count).toHaveBeenCalledWith({ where });
    expect(findMany).toHaveBeenCalledWith({
      where, orderBy: [{ name: "asc" }, { id: "asc" }], skip: 1, take: 1,
    });
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  test("includes active and inactive branches by default", async () => {
    const items = [{ isActive: true }, { isActive: false }];
    const { repository, count } = setup(items, 2);
    expect(await repository.listAdminBranches({ page: 1, limit: 20 }))
      .toEqual({ items, page: 1, limit: 20, total: 2 });
    expect(count).toHaveBeenCalledWith({ where: {} });
  });

  test("includes active-only filter when explicitly requested", async () => {
    const { repository, count } = setup();
    await repository.listAdminBranches({ isActive: true, page: 1, limit: 20 });
    expect(count).toHaveBeenCalledWith({ where: { isActive: true } });
  });

  test("loads an inactive branch with its class history", async () => {
    const detail = { id: branchId, isActive: false, scheduledClasses: [{ id: "class-id" }] };
    const { repository, findUnique } = setup([], 0, detail);
    expect(await repository.findAdminBranchById(branchId)).toEqual(detail);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: branchId },
      select: expect.objectContaining({
        isActive: true,
        scheduledClasses: {
          orderBy: [{ startsAt: "asc" }, { id: "asc" }],
          select: {
            id: true, activity: true, startsAt: true,
            trainer: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      }),
    });
  });
});

describe("SED-05 branch status repository", () => {
  test("changes only isActive and keeps the same branch", async () => {
    const { repository, update } = setup();
    expect(await repository.updateBranchStatus(branchId, { isActive: false }))
      .toEqual({ id: branchId, isActive: false });
    expect(update).toHaveBeenCalledWith({ where: { id: branchId },
      data: { isActive: false } });
  });

  test("maps a missing branch to a not-found error", async () => {
    const { repository, update } = setup();
    update.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("not found", {
      code: "P2025", clientVersion: "7.10.0",
    }));
    await expect(repository.updateBranchStatus(branchId, { isActive: true }))
      .rejects.toBeInstanceOf(BranchNotFoundError);
  });
});
