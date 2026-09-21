import express, { type RequestHandler } from "express";
import request from "supertest";

import { AuthController } from "../../src/controller/auth-controller.js";
import { ApplicationError } from "../../src/error/application-error.js";
import { ERROR_CODE } from "../../src/error/error-code.js";
import { errorMiddleware } from "../../src/middleware/error-middleware.js";
import { createProtectedAuthRouter } from "../../src/route/auth-route.js";
import type {
  MemberRegistrationService,
  PasswordManagementService,
  UserLoginService,
} from "../../src/service/auth-service.js";

const userId = "83cd902e-0475-4c92-943c-129b751dacee";

function setup(authenticated = true, isPasswordChangeRequired = false) {
  const service: jest.Mocked<
    MemberRegistrationService & UserLoginService & PasswordManagementService
  > = {
    registerMember: jest.fn(),
    login: jest.fn(),
    changePassword: jest.fn().mockResolvedValue(undefined),
  };
  const authenticate: RequestHandler = (request, _response, next) => {
    if (!authenticated) {
      throw new ApplicationError(
        401,
        ERROR_CODE.UNAUTHORIZED,
        "Se requiere una autenticación válida",
      );
    }
    request.authenticatedUser = {
      id: userId,
      role: "MEMBER",
      isPasswordChangeRequired,
    };
    next();
  };
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createProtectedAuthRouter(new AuthController(service), authenticate),
  );
  app.use(errorMiddleware);
  return { app, service };
}

describe("PATCH /api/auth/password", () => {
  test("returns 204 after changing the authenticated user's password", async () => {
    const { app, service } = setup();
    const response = await request(app).patch("/api/auth/password").send({
      currentPassword: "current-password",
      newPassword: "new-password",
    });

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
    expect(service.changePassword).toHaveBeenCalledWith(userId, {
      currentPassword: "current-password",
      newPassword: "new-password",
    });
  });

  test.each([
    {},
    { currentPassword: "", newPassword: "new-password" },
    { currentPassword: "current", newPassword: "short" },
    { currentPassword: "same-password", newPassword: "same-password" },
    { currentPassword: "current", newPassword: "new-password", role: "ADMIN" },
  ])("rejects an invalid request: %j", async (body) => {
    const { app, service } = setup();
    const response = await request(app).patch("/api/auth/password").send(body);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(service.changePassword).not.toHaveBeenCalled();
  });

  test("requires authentication", async () => {
    const { app, service } = setup(false);
    const response = await request(app).patch("/api/auth/password").send({
      currentPassword: "current-password",
      newPassword: "new-password",
    });

    expect(response.status).toBe(401);
    expect(service.changePassword).not.toHaveBeenCalled();
  });

  test("remains available when a temporary password must be changed", async () => {
    const { app, service } = setup(true, true);
    const response = await request(app).patch("/api/auth/password").send({
      currentPassword: "temporary-password",
      newPassword: "permanent-password",
    });

    expect(response.status).toBe(204);
    expect(service.changePassword).toHaveBeenCalledWith(userId, {
      currentPassword: "temporary-password",
      newPassword: "permanent-password",
    });
  });
});
