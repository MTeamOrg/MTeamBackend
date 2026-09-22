import express, { type RequestHandler } from "express";
import request from "supertest";

import { AdminUserController } from "../../src/controller/admin-user-controller.js";
import { ApplicationError } from "../../src/error/application-error.js";
import { ERROR_CODE } from "../../src/error/error-code.js";
import { errorMiddleware } from "../../src/middleware/error-middleware.js";
import { requirePasswordChangeCompleted } from "../../src/middleware/password-change-middleware.js";
import { createAdminUserRouter } from "../../src/route/admin-user-route.js";
import type { AdminUserManagementService, TemporaryPasswordResetService } from "../../src/service/admin-user-service.js";

const targetUserId = "83cd902e-0475-4c92-943c-129b751dacee";
const adminId = "212a6da6-063c-44c9-b63c-1d67602cb487";

const user = {
  id: targetUserId,
  firstName: "Lara",
  lastName: "Frenkel",
  documentNumber: "12345678",
  email: "lara@example.com",
  role: "MEMBER" as const,
  status: "ACTIVE" as const,
};

const auditLog = {
  id: "cb2c39af-6e24-4dc2-955e-04ca6f9a2f8f",
  userId: targetUserId,
  action: "DEACTIVATED" as const,
  reason: "Baja solicitada por el gimnasio",
  occurredAt: new Date("2026-09-22T12:00:00.000Z"),
  performedBy: {
    id: adminId,
    firstName: "Admin",
    lastName: "M-Team",
    email: "admin@example.com",
    role: "ADMIN" as const,
  },
};

function setup(role: "ADMIN" | "MEMBER" | null = "ADMIN", passwordChangeRequired = false) {
  const service: jest.Mocked<TemporaryPasswordResetService & AdminUserManagementService> = {
    resetTemporaryPassword: jest.fn().mockResolvedValue(undefined),
    listUsers: jest.fn().mockResolvedValue({ items: [user], page: 1, limit: 20, total: 1 }),
    updateUserStatus: jest.fn().mockResolvedValue({ ...user, status: "INACTIVE" }),
    listUserAuditLogs: jest.fn().mockResolvedValue({ items: [auditLog], page: 1, limit: 20, total: 1 }),
  };
  const authenticate: RequestHandler = (request, _response, next) => {
    if (!role) {
      throw new ApplicationError(401, ERROR_CODE.UNAUTHORIZED, "Se requiere una autenticación válida");
    }
    request.authenticatedUser = { id: adminId, role, isPasswordChangeRequired: passwordChangeRequired };
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

describe("ADM-01 user listing", () => {
  test("lists users with documented search, filters and pagination", async () => {
    const { app, service } = setup();
    const response = await request(app)
      .get("/api/users")
      .query({ search: " Lara ", role: "MEMBER", status: "ACTIVE", page: "2", limit: "10" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [user], page: 1, limit: 20, total: 1 });
    expect(service.listUsers).toHaveBeenCalledWith({
      search: "Lara", role: "MEMBER", status: "ACTIVE", page: 2, limit: 10,
    });
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
  });

  test("rejects unknown filters and non-admin users", async () => {
    const invalid = await request(setup().app).get("/api/users").query({ unexpected: "value" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe("VALIDATION_ERROR");

    const forbidden = await request(setup("MEMBER").app).get("/api/users");
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.code).toBe("FORBIDDEN");
  });
});

describe("ADM-05 account status", () => {
  test("deactivates an account using the authenticated administrator and reason", async () => {
    const { app, service } = setup();
    const response = await request(app)
      .patch(`/api/users/${targetUserId}/status`)
      .send({ status: "INACTIVE", reason: "  Baja solicitada por el gimnasio  " });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("INACTIVE");
    expect(service.updateUserStatus).toHaveBeenCalledWith(
      targetUserId,
      adminId,
      { status: "INACTIVE", reason: "Baja solicitada por el gimnasio" },
    );
  });

  test("validates status input, authentication and temporary-password restrictions", async () => {
    const invalid = await request(setup().app)
      .patch(`/api/users/${targetUserId}/status`)
      .send({ status: "DISABLED", extra: true });
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe("VALIDATION_ERROR");

    const unauthenticated = await request(setup(null).app)
      .patch(`/api/users/${targetUserId}/status`)
      .send({ status: "INACTIVE" });
    expect(unauthenticated.status).toBe(401);

    const pendingPassword = await request(setup("ADMIN", true).app)
      .patch(`/api/users/${targetUserId}/status`)
      .send({ status: "INACTIVE" });
    expect(pendingPassword.status).toBe(403);
    expect(pendingPassword.body.code).toBe("PASSWORD_CHANGE_REQUIRED");
  });
});

describe("ADM-06 audit history", () => {
  test("returns a read-only paginated audit history with responsible administrator", async () => {
    const { app, service } = setup();
    service.listUserAuditLogs.mockResolvedValue({ items: [auditLog], page: 2, limit: 5, total: 21 });
    const response = await request(app)
      .get(`/api/users/${targetUserId}/audit-logs`)
      .query({ page: "2", limit: "5" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [{ ...auditLog, occurredAt: auditLog.occurredAt.toISOString() }],
      page: 2,
      limit: 5,
      total: 21,
    });
    expect(service.listUserAuditLogs).toHaveBeenCalledWith(targetUserId, 2, 5);
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
  });

  test("does not allow non-admin access", async () => {
    const response = await request(setup("MEMBER").app)
      .get(`/api/users/${targetUserId}/audit-logs`);
    expect(response.status).toBe(403);
    expect(response.body.code).toBe("FORBIDDEN");
  });
});
