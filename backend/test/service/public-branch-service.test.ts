import type { BranchRepositoryPort } from "../../src/repository/branch-repository.js";
import { BranchService } from "../../src/service/branch-service.js";

describe("public branch detail", () => {
  test("treats missing or inactive branches as not found", async () => {
    const repository = {
      findPublicBranchById: jest.fn().mockResolvedValue(null),
    } as unknown as BranchRepositoryPort;
    const service = new BranchService(repository);
    await expect(service.getPublicBranch("83cd902e-0475-4c92-943c-129b751dacee"))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});
