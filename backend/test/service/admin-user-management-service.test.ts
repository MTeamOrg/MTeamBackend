import { ApplicationError } from "../../src/error/application-error.js";
import type {
  AdminUserRepositoryPort,
  TemporaryPasswordRepositoryPort,
} from "../../src/repository/user-repository.js";
import { AdminUserService } from "../../src/service/admin-user-service.js";
import type { PasswordHasher } from "../../src/service/password-service.js";

const userId = "83cd902e-0475-4c92-943c-129b751dacee";
const adminId = "212a6da6-063c-44c9-b63c-1d67602cb487";
const user = {
  id: userId,
  firstName: "Lara",
  lastName: "Frenkel",
  documentNumber: "12345678",
  email: "lara@example.com",
  role: "MEMBER" as const,
  status: "ACTIVE" as const,
};

function setup() {
  const repository: jest.Mocked<TemporaryPasswordRepositoryPort & AdminUserRepositoryPort> = {
    findPasswordResetTargetById: jest.fn(),
    resetTemporaryPassword: jest.fn(),
    listUsers: jest.fn().mockResolvedValue({ items: [user], page: 1, limit: 20, total: 1 }),
    findUserById: jest.fn().mockResolvedValue(user),
    updateUserStatus: jest.fn().mockResolvedValue({ ...user, status: "INACTIVE" }),
    listUserAuditLogs: jest.fn().mockResolvedValue({ items: [], page: 1, limit: 20, total: 0 }),
  };
  const passwordHasher: PasswordHasher = { hash: jest.fn(), };
  return { repository, service: new AdminUserService(repository, passwordHasher) };
}

describe("AdminUserService", () => {
  test("delegates ADM-01 filters without changing them", async () => {
    const { repository, service } = setup();
    const query = { search: "Lara", role: "MEMBER" as const, page: 1, limit: 20 };
    await service.listUsers(query);
    expect(repository.listUsers).toHaveBeenCalledWith(query);
  });

  test("updates status with the administrator identity and keeps status changes auditable", async () => {
    const { repository, service } = setup();
    await service.updateUserStatus(userId, adminId, { status: "INACTIVE", reason: "Baja" });
    expect(repository.findUserById).toHaveBeenCalledWith(userId);
    expect(repository.updateUserStatus).toHaveBeenCalledWith(
      userId,
      adminId,
      { status: "INACTIVE", reason: "Baja" },
    );
  });

  test("rejects status changes and audit queries for unknown users", async () => {
    const { repository, service } = setup();
    repository.findUserById.mockResolvedValue(null);
    await expect(service.updateUserStatus(userId, adminId, { status: "INACTIVE" }))
      .rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" } satisfies Partial<ApplicationError>);
    await expect(service.listUserAuditLogs(userId, 1, 20))
      .rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" } satisfies Partial<ApplicationError>);
    expect(repository.updateUserStatus).not.toHaveBeenCalled();
    expect(repository.listUserAuditLogs).not.toHaveBeenCalled();
  });
});
