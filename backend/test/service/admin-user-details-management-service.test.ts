import { ApplicationError } from "../../src/error/application-error.js";
import { ERROR_CODE } from "../../src/error/error-code.js";
import {
  DuplicateUserError,
  type AdminUserDetail,
  type AdminUserRepositoryPort,
  type TemporaryPasswordRepositoryPort,
} from "../../src/repository/user-repository.js";
import { AdminUserService } from "../../src/service/admin-user-service.js";
import type { PasswordHasher } from "../../src/service/password-service.js";

const userId = "83cd902e-0475-4c92-943c-129b751dacee";
const adminId = "212a6da6-063c-44c9-b63c-1d67602cb487";

function user(role: "MEMBER" | "TRAINER" | "ADMIN"): AdminUserDetail {
  return {
    id: userId,
    firstName: "Ana",
    lastName: "Lara",
    documentNumber: "30111222",
    birthDate: new Date("1990-01-02T00:00:00.000Z"),
    email: "ana@example.com",
    phone: "1100000000",
    photoUrl: null,
    role,
    status: "ACTIVE",
    isPasswordChangeRequired: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    memberProfile: role === "MEMBER" ? { emergencyContactName: "", emergencyContactPhone: "" } : null,
    trainerProfile: role === "TRAINER" ? { specialty: "Fuerza", description: "Entrenador" } : null,
    membership: null,
    payments: [],
    medicalCertificates: [],
    trainerBranches: [],
    classes: [],
  };
}

function setup(role: "MEMBER" | "TRAINER" | "ADMIN" = "MEMBER") {
  const repository: jest.Mocked<TemporaryPasswordRepositoryPort & AdminUserRepositoryPort> = {
    findConflict: jest.fn().mockResolvedValue(null),
    findConflictForUpdate: jest.fn().mockResolvedValue(null),
    findAdminUserDetailById: jest.fn().mockResolvedValue(user(role)),
    createAdminUser: jest.fn().mockResolvedValue(user("MEMBER")),
    updateAdminUser: jest.fn().mockResolvedValue(user(role)),
    findPasswordResetTargetById: jest.fn(),
    resetTemporaryPassword: jest.fn(),
    listUsers: jest.fn(),
    findUserById: jest.fn(),
    updateUserStatus: jest.fn(),
    listUserAuditLogs: jest.fn(),
  };
  const passwordHasher: jest.Mocked<PasswordHasher> = {
    hash: jest.fn().mockResolvedValue("bcrypt-hash"),
  };
  return { repository, passwordHasher, service: new AdminUserService(repository, passwordHasher) };
}

describe("AdminUserService ADM-02/03/04", () => {
  test("normalizes administrative creation and hashes the password", async () => {
    const { repository, passwordHasher, service } = setup();

    await service.createUser(adminId, {
      role: "MEMBER",
      firstName: " Ana ",
      lastName: " Lara ",
      documentNumber: "30.111.222",
      birthDate: "1990-01-02",
      email: " ANA@EXAMPLE.COM ",
      phone: " 1100000000 ",
      password: "temporary-password",
      emergencyContactName: " Luis ",
      emergencyContactPhone: " 1111111111 ",
    });

    expect(passwordHasher.hash).toHaveBeenCalledWith("temporary-password");
    expect(repository.createAdminUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "ana@example.com",
        documentNumber: "30111222",
        passwordHash: "bcrypt-hash",
        role: "MEMBER",
        memberProfile: {
          emergencyContactName: "Luis",
          emergencyContactPhone: "1111111111",
        },
      }),
      adminId,
    );
  });

  test("requires trainer fields and creates only trainer data", async () => {
    const { repository, service } = setup();
    await service.createUser(adminId, {
      role: "TRAINER",
      firstName: "Ana",
      lastName: "Lara",
      documentNumber: "30111222",
      birthDate: "1990-01-02",
      email: "ana@example.com",
      phone: "1100000000",
      password: "temporary-password",
      specialty: " Fuerza ",
      description: " Entrenador ",
    });

    const data = repository.createAdminUser.mock.calls[0]![0];
    expect(data.trainerProfile).toEqual({ specialty: "Fuerza", description: "Entrenador" });
    expect(data.memberProfile).toBeUndefined();
  });

  test("translates duplicate conflicts to the uniform error", async () => {
    const { repository, service } = setup();
    repository.findConflict.mockResolvedValue("documentNumber");

    await expect(service.createUser(adminId, {
      role: "ADMIN",
      firstName: "Ana",
      lastName: "Lara",
      documentNumber: "30111222",
      birthDate: "1990-01-02",
      email: "ana@example.com",
      phone: "1100000000",
      password: "temporary-password",
    })).rejects.toMatchObject({
      statusCode: 409,
      code: ERROR_CODE.CONFLICT,
      details: { field: "documentNumber" },
    });
  });

  test("normalizes updates and records the administrator identity", async () => {
    const { repository, service } = setup("MEMBER");
    await service.updateUser(userId, adminId, {
      email: " NEW@EXAMPLE.COM ",
      documentNumber: "30.222.333",
      emergencyContactName: "Nuevo contacto",
      reason: "Corrección",
    });

    expect(repository.findConflictForUpdate).toHaveBeenCalledWith(
      "new@example.com",
      "30222333",
      userId,
    );
    expect(repository.updateAdminUser).toHaveBeenCalledWith(
      userId,
      adminId,
      expect.objectContaining({
        email: "new@example.com",
        documentNumber: "30222333",
        emergencyContactName: "Nuevo contacto",
        reason: "Corrección",
      }),
    );
  });

  test("does not allow profile fields for an unrelated role", async () => {
    const { service } = setup("ADMIN");

    await expect(service.updateUser(userId, adminId, { specialty: "Fuerza" }))
      .rejects.toMatchObject({
        statusCode: 400,
        code: ERROR_CODE.VALIDATION_ERROR,
      } satisfies Partial<ApplicationError>);
  });
});
