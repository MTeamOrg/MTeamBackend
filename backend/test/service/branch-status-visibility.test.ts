import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { BranchNotFoundError, BranchRepository,
  type BranchRepositoryPort } from "../../src/repository/branch-repository.js";
import { BranchService } from "../../src/service/branch-service.js";

const branchId = "83cd902e-0475-4c92-943c-129b751dacee";

test("deactivation hides the public branch, activation restores it, and class history remains", async () => {
  const branch = {
    id: branchId, name: "Sede Centro", isActive: true,
    scheduledClasses: [{ id: "f12101a5-e6ab-43f7-91b3-2b8fbfd67b84" }],
  };
  const update = jest.fn().mockImplementation(async ({ data }: { data: { isActive: boolean } }) => {
    branch.isActive = data.isActive;
    return { ...branch };
  });
  const database = {
    branch: {
      count: jest.fn().mockImplementation(async ({ where }: { where: { isActive?: boolean } }) =>
        where.isActive === undefined || where.isActive === branch.isActive ? 1 : 0),
      findMany: jest.fn().mockImplementation(async ({ where }: { where: { isActive?: boolean } }) =>
        where.isActive === undefined || where.isActive === branch.isActive ? [{ ...branch }] : []),
      findFirst: jest.fn().mockImplementation(async ({ where }: { where: { isActive: boolean } }) =>
        where.isActive === branch.isActive ? { ...branch } : null),
      findUnique: jest.fn().mockImplementation(async () => ({ ...branch })),
      update,
    },
    $transaction: jest.fn().mockImplementation((operations: Promise<unknown>[]) =>
      Promise.all(operations)),
  } as unknown as PrismaClient;
  const service = new BranchService(new BranchRepository(database));
  const query = { page: 1, limit: 20 };

  expect((await service.listPublicBranches(query)).total).toBe(1);
  await expect(service.getPublicBranch(branchId)).resolves.toMatchObject({ id: branchId });

  await service.updateBranchStatus(branchId, { isActive: false });
  expect((await service.listPublicBranches(query)).total).toBe(0);
  await expect(service.getPublicBranch(branchId)).rejects.toMatchObject({ statusCode: 404 });
  await expect(service.getAdminBranch(branchId)).resolves.toMatchObject({
    isActive: false, scheduledClasses: branch.scheduledClasses,
  });

  await service.updateBranchStatus(branchId, { isActive: true });
  expect((await service.listPublicBranches(query)).total).toBe(1);
  await expect(service.getPublicBranch(branchId)).resolves.toMatchObject({ id: branchId });
  expect(branch.scheduledClasses).toHaveLength(1);
  expect(update).toHaveBeenCalledTimes(2);
});

test("maps missing administrative detail and status changes to 404", async () => {
  const repository = {
    findAdminBranchById: jest.fn().mockResolvedValue(null),
    updateBranchStatus: jest.fn().mockRejectedValue(new BranchNotFoundError()),
  } as unknown as BranchRepositoryPort;
  const service = new BranchService(repository);
  await expect(service.getAdminBranch(branchId)).rejects.toMatchObject({ statusCode: 404 });
  await expect(service.updateBranchStatus(branchId, { isActive: false }))
    .rejects.toMatchObject({ statusCode: 404 });
});
