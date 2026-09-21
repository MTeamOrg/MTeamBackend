import type { TemporaryPasswordRepositoryPort } from "../../src/repository/user-repository.js";
import { AdminUserService } from "../../src/service/admin-user-service.js";
import type { PasswordHasher } from "../../src/service/password-service.js";

const userId = "83cd902e-0475-4c92-943c-129b751dacee";
const adminId = "212a6da6-063c-44c9-b63c-1d67602cb487";

function setup(targetExists = true) {
  const repository: jest.Mocked<TemporaryPasswordRepositoryPort> = {
    findPasswordResetTargetById: jest
      .fn()
      .mockResolvedValue(targetExists ? { id: userId } : null),
    resetTemporaryPassword: jest.fn().mockResolvedValue(undefined),
  };
  const passwordHasher: jest.Mocked<PasswordHasher> = {
    hash: jest.fn().mockResolvedValue("stored-password-hash"),
  };
  return {
    repository,
    passwordHasher,
    service: new AdminUserService(repository, passwordHasher),
  };
}

describe("AdminUserService.resetTemporaryPassword", () => {
  test("stores only the hash and records the administrator actor", async () => {
    const { service, repository, passwordHasher } = setup();

    await service.resetTemporaryPassword(userId, adminId, {
      temporaryPassword: "temporary-password",
    });

    expect(passwordHasher.hash).toHaveBeenCalledWith("temporary-password");
    expect(repository.resetTemporaryPassword).toHaveBeenCalledWith(
      userId,
      adminId,
      "stored-password-hash",
    );
    expect(repository.resetTemporaryPassword).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "temporary-password",
    );
  });

  test("returns not found without hashing or writing when the target does not exist", async () => {
    const { service, repository, passwordHasher } = setup(false);

    await expect(
      service.resetTemporaryPassword(userId, adminId, {
        temporaryPassword: "temporary-password",
      }),
    ).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(repository.resetTemporaryPassword).not.toHaveBeenCalled();
  });
});
