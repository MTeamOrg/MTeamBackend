import express, { type RequestHandler } from "express";
import request from "supertest";

import { AdminUserController } from "../../src/controller/admin-user-controller.js";
import { ApplicationError } from "../../src/error/application-error.js";
import { ERROR_CODE } from "../../src/error/error-code.js";
import { errorMiddleware } from "../../src/middleware/error-middleware.js";
import { requirePasswordChangeCompleted } from "../../src/middleware/password-change-middleware.js";
import { createAdminUserRouter } from "../../src/route/admin-user-route.js";
import type { TemporaryPasswordResetService } from "../../src/service/admin-user-service.js";

const userId = "83cd902e-0475-4c92-943c-129b751dacee";
const adminId = "212a6da6-063c-44c9-b63c-1d67602cb487";

function setup(
  role: "MEMBER" | "TRAINER" | "ADMIN" | null = "ADMIN",
  isPasswordChangeRequired = false,
) {
  const service: jest.Mocked<TemporaryPasswordResetService> = {
    resetTemporaryPassword: jest.fn().mockResolvedValue(undefined),
  };
  const authenticate: RequestHandler = (req, _res, next) => {
    if (!role) {
      throw new ApplicationError(
        401,
        ERROR_CODE.UNAUTHORIZED,
        "Se requiere una autenticación válida",
      );
    }
    req.authenticatedUser = { id: adminId, role, isPasswordChangeRequired };
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

describe("POST /api/users/:userId/password-resets", () => {
  test("allows an administrator to assign a temporary password", async () => {
    const { app, service } = setup();

    const response = await request(app)
      .post(`/api/users/${userId}/password-resets`)
      .send({ temporaryPassword: "temporary-password" });

    expect(response.status).toBe(204);
    expect(service.resetTemporaryPassword).toHaveBeenCalledWith(
      userId,
      adminId,
      { temporaryPassword: "temporary-password" },
    );
  });

  test.each([
    ["invalid user id", "/api/users/not-a-uuid/password-resets", { temporaryPassword: "temporary-password" }],
    ["short password", `/api/users/${userId}/password-resets`, { temporaryPassword: "short" }],
    ["unknown field", `/api/users/${userId}/password-resets`, { temporaryPassword: "temporary-password", role: "ADMIN" }],
  ])("rejects %s", async (_name, path, body) => {
    const { app, service } = setup();

    const response = await request(app).post(path).send(body);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(service.resetTemporaryPassword).not.toHaveBeenCalled();
  });

  test.each(["MEMBER", "TRAINER"] as const)("rejects the %s role", async (role) => {
    const { app, service } = setup(role);

    const response = await request(app)
      .post(`/api/users/${userId}/password-resets`)
      .send({ temporaryPassword: "temporary-password" });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("FORBIDDEN");
    expect(service.resetTemporaryPassword).not.toHaveBeenCalled();
  });

  test("requires authentication", async () => {
    const { app, service } = setup(null);

    const response = await request(app)
      .post(`/api/users/${userId}/password-resets`)
      .send({ temporaryPassword: "temporary-password" });

    expect(response.status).toBe(401);
    expect(service.resetTemporaryPassword).not.toHaveBeenCalled();
  });

  test("blocks an administrator who must change a temporary password", async () => {
    const { app, service } = setup("ADMIN", true);

    const response = await request(app)
      .post(`/api/users/${userId}/password-resets`)
      .send({ temporaryPassword: "temporary-password" });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("PASSWORD_CHANGE_REQUIRED");
    expect(service.resetTemporaryPassword).not.toHaveBeenCalled();
  });
});
