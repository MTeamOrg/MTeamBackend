import express, { type RequestHandler } from "express";
import request from "supertest";

import { AdminUserController } from "../../src/controller/admin-user-controller.js";
import { ApplicationError } from "../../src/error/application-error.js";
import { ERROR_CODE } from "../../src/error/error-code.js";
import { errorMiddleware } from "../../src/middleware/error-middleware.js";
import { requirePasswordChangeCompleted } from "../../src/middleware/password-change-middleware.js";
import { createAdminUserRouter } from "../../src/route/admin-user-route.js";
import type {
  AdminUserDetail,
  UserAuditLogListResult,
  UserListResult,
} from "../../src/repository/user-repository.js";
import type {
  AdminUserManagementService,
  TemporaryPasswordResetService,
} from "../../src/service/admin-user-service.js";

const adminId = "212a6da6-063c-44c9-b63c-1d67602cb487";
const userId = "83cd902e-0475-4c92-943c-129b751dacee";

function detail(role: "MEMBER" | "TRAINER" | "ADMIN"): AdminUserDetail {
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
    isPasswordChangeRequired: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    memberProfile: role === "MEMBER"
      ? { emergencyContactName: "Luis", emergencyContactPhone: "1111111111" }
      : null,
    trainerProfile: role === "TRAINER"
      ? { specialty: "Fuerza", description: "Entrenamiento personalizado" }
      : null,
    membership: null,
    payments: [],
    medicalCertificates: [],
    trainerBranches: [],
    classes: [],
  };
}

function setup(
  role: "MEMBER" | "TRAINER" | "ADMIN" | null = "ADMIN",
  passwordChangeRequired = false,
) {
  const service: jest.Mocked<
    AdminUserManagementService & TemporaryPasswordResetService
  > = {
    listUsers: jest.fn<Promise<UserListResult>, []>(),
    getUser: jest.fn().mockResolvedValue(detail("MEMBER")),
    createUser: jest.fn().mockResolvedValue(detail("MEMBER")),
    updateUser: jest.fn().mockResolvedValue(detail("MEMBER")),
    updateUserStatus: jest.fn(),
    listUserAuditLogs: jest.fn<Promise<UserAuditLogListResult>, []>(),
    resetTemporaryPassword: jest.fn().mockResolvedValue(undefined),
  };
  const authenticate: RequestHandler = (request, _response, next) => {
    if (!role) {
      throw new ApplicationError(
        401,
        ERROR_CODE.UNAUTHORIZED,
        "Se requiere una autenticación válida",
      );
    }
    request.authenticatedUser = {
      id: adminId,
      role,
      isPasswordChangeRequired: passwordChangeRequired,
    };
    next();
  };
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createAdminUserRouter(
      new AdminUserController(service),
      authenticate,
      requirePasswordChangeCompleted,
    ),
  );
  app.use(errorMiddleware);
  return { app, service };
}

describe("GET /api/users/:userId", () => {
  test.each(["MEMBER", "TRAINER", "ADMIN"] as const)(
    "allows an administrator to consult a %s",
    async (role) => {
      const { app, service } = setup();
      service.getUser.mockResolvedValue(detail(role));

      const response = await request(app).get(`/api/users/${userId}`);

      expect(response.status).toBe(200);
      expect(response.body.role).toBe(role);
      expect(response.body).not.toHaveProperty("passwordHash");
      expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    },
  );

  test("rejects unauthenticated and non-administrator requests", async () => {
    const unauthenticated = await request(setup(null).app).get(`/api/users/${userId}`);
    expect(unauthenticated.status).toBe(401);

    const member = await request(setup("MEMBER").app).get(`/api/users/${userId}`);
    expect(member.status).toBe(403);
  });

  test("returns the uniform not found error", async () => {
    const { app, service } = setup();
    service.getUser.mockRejectedValue(
      new ApplicationError(404, ERROR_CODE.NOT_FOUND, "El usuario no existe"),
    );

    const response = await request(app).get(`/api/users/${userId}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      code: "NOT_FOUND",
      message: "El usuario no existe",
      details: null,
    });
  });
});

describe("POST /api/users", () => {
  test.each([
    ["MEMBER", { emergencyContactName: "Luis", emergencyContactPhone: "1111111111" }],
    ["TRAINER", { specialty: "Fuerza", description: "Entrenamiento" }],
    ["ADMIN", {}],
  ] as const)("creates a %s account", async (role, specificFields) => {
    const { app, service } = setup();
    service.createUser.mockResolvedValue(detail(role));

    const response = await request(app).post("/api/users").send({
      firstName: "Ana",
      lastName: "Lara",
      documentNumber: "30.111.222",
      birthDate: "1990-01-02",
      email: " ANA@EXAMPLE.COM ",
      phone: "1100000000",
      password: "temporary-password",
      role,
      ...specificFields,
    });

    expect(response.status).toBe(201);
    expect(response.body.role).toBe(role);
    expect(response.body).not.toHaveProperty("password");
    expect(response.body).not.toHaveProperty("passwordHash");
    expect(service.createUser).toHaveBeenCalledWith(
      adminId,
      expect.objectContaining({ role }),
    );
  });

  test.each([
    { role: "MEMBER", unknown: true },
    { role: "INVALID" },
  ])("rejects invalid or unknown role data", async (body) => {
    const { app, service } = setup();
    const response = await request(app).post("/api/users").send({
      firstName: "Ana",
      lastName: "Lara",
      documentNumber: "30111222",
      birthDate: "1990-01-02",
      email: "ana@example.com",
      phone: "1100000000",
      password: "temporary-password",
      ...body,
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(service.createUser).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/users/:userId", () => {
  test("modifies an administrator-managed field and returns the safe detail", async () => {
    const { app, service } = setup();
    service.updateUser.mockResolvedValue(detail("MEMBER"));

    const response = await request(app)
      .patch(`/api/users/${userId}`)
      .send({ firstName: "  Ana María  ", reason: "Corrección administrativa" });

    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty("passwordHash");
    expect(service.updateUser).toHaveBeenCalledWith(
      userId,
      adminId,
      { firstName: "Ana María", reason: "Corrección administrativa" },
    );
  });

  test("rejects empty or protected fields", async () => {
    const { app, service } = setup();
    const response = await request(app)
      .patch(`/api/users/${userId}`)
      .send({ role: "ADMIN" });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(service.updateUser).not.toHaveBeenCalled();
  });

  test.each([
    [404, "NOT_FOUND"],
    [409, "CONFLICT"],
  ] as const)("propagates administrative update error %s", async (statusCode, code) => {
    const { app, service } = setup();
    service.updateUser.mockRejectedValue(
      new ApplicationError(statusCode, code, "Operación no disponible"),
    );

    const response = await request(app)
      .patch(`/api/users/${userId}`)
      .send({ firstName: "Ana" });

    expect(response.status).toBe(statusCode);
    expect(response.body.code).toBe(code);
  });
});
