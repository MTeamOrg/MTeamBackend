import type {
  AuthenticationUser,
  CreateMemberData,
  PasswordRepositoryPort,
  RegisteredMember,
  UserConflictField,
  UserRepositoryPort,
} from "../../src/repository/user-repository.js";
import { AuthService } from "../../src/service/auth-service.js";
import { PasswordService } from "../../src/service/password-service.js";
import type { TokenIssuer } from "../../src/service/token-service.js";

const userId = "83cd902e-0475-4c92-943c-129b751dacee";

class FakePasswordRepository implements UserRepositoryPort, PasswordRepositoryPort {
  passwordHash = "";
  changedHash: string | null = null;
  exists = true;

  async findPasswordUserById() {
    return this.exists ? { passwordHash: this.passwordHash } : null;
  }

  async changePassword(_id: string, passwordHash: string): Promise<void> {
    this.changedHash = passwordHash;
  }

  async findByEmail(): Promise<AuthenticationUser | null> {
    return null;
  }

  async findConflict(): Promise<UserConflictField | null> {
    return null;
  }

  async createMember(_data: CreateMemberData): Promise<RegisteredMember> {
    throw new Error("Not used in these tests");
  }
}

const tokenIssuer: TokenIssuer = {
  expiresIn: 3600,
  sign: jest.fn(),
};

describe("AuthService.changePassword", () => {
  test("verifies the current password and stores only the new hash", async () => {
    const repository = new FakePasswordRepository();
    const passwordService = new PasswordService();
    repository.passwordHash = await passwordService.hash("current-password");
    const service = new AuthService(repository, passwordService, tokenIssuer);

    await service.changePassword(userId, {
      currentPassword: "current-password",
      newPassword: "new-password",
    });

    expect(repository.changedHash).not.toBe("new-password");
    await expect(
      passwordService.compare("new-password", repository.changedHash!),
    ).resolves.toBe(true);
  });

  test("rejects an incorrect current password without writing", async () => {
    const repository = new FakePasswordRepository();
    const passwordService = new PasswordService();
    repository.passwordHash = await passwordService.hash("current-password");

    await expect(
      new AuthService(repository, passwordService, tokenIssuer).changePassword(
        userId,
        { currentPassword: "incorrect-password", newPassword: "new-password" },
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "INVALID_CURRENT_PASSWORD",
    });
    expect(repository.changedHash).toBeNull();
  });

  test("rejects reuse of the stored password", async () => {
    const repository = new FakePasswordRepository();
    const passwordService = new PasswordService();
    repository.passwordHash = await passwordService.hash("same-password");

    await expect(
      new AuthService(repository, passwordService, tokenIssuer).changePassword(
        userId,
        { currentPassword: "same-password", newPassword: "same-password" },
      ),
    ).rejects.toMatchObject({ statusCode: 400, code: "PASSWORD_REUSE" });
    expect(repository.changedHash).toBeNull();
  });

  test("returns not found if the authenticated user no longer exists", async () => {
    const repository = new FakePasswordRepository();
    repository.exists = false;

    await expect(
      new AuthService(repository, new PasswordService(), tokenIssuer).changePassword(
        userId,
        { currentPassword: "current-password", newPassword: "new-password" },
      ),
    ).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
  });
});
