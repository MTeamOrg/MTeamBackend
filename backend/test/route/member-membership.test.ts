import express, { type RequestHandler } from "express";
import request from "supertest";

import { MemberMembershipController } from "../../src/controller/member-membership-controller.js";
import { ApplicationError } from "../../src/error/application-error.js";
import { ERROR_CODE } from "../../src/error/error-code.js";
import type { UserRole } from "../../src/generated/prisma/client.js";
import { errorMiddleware } from "../../src/middleware/error-middleware.js";
import { requirePasswordChangeCompleted } from "../../src/middleware/password-change-middleware.js";
import { createMemberMembershipRouter } from "../../src/route/member-membership-route.js";
import type { MemberMembershipService } from "../../src/service/member-membership-service.js";

const memberId = "83cd902e-0475-4c92-943c-129b751dacee";

function setup(role: UserRole | null, isPasswordChangeRequired = false) {
  const service = {
    getOwnMembership: jest.fn().mockResolvedValue({
      currentPrice: "18000.00",
      lastPaymentAt: null,
      expiresAt: null,
      daysRemaining: 0,
      status: "EXPIRED",
    }),
  };
  const authenticate: RequestHandler = (request, _response, next) => {
    if (!role) throw new ApplicationError(401, ERROR_CODE.UNAUTHORIZED, "Authentication required");
    request.authenticatedUser = { id: memberId, role, isPasswordChangeRequired };
    next();
  };
  const app = express();
  app.use(
    "/api",
    createMemberMembershipRouter(
      new MemberMembershipController(service as unknown as MemberMembershipService),
      authenticate,
      requirePasswordChangeCompleted,
    ),
  );
  app.use(errorMiddleware);
  return { app, service };
}

describe("GET /api/members/me/membership", () => {
  test("returns only the authenticated member's membership", async () => {
    const { app, service } = setup("MEMBER");
    const response = await request(app).get("/api/members/me/membership");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      currentPrice: "18000.00",
      lastPaymentAt: null,
      expiresAt: null,
      daysRemaining: 0,
      status: "EXPIRED",
    });
    expect(service.getOwnMembership).toHaveBeenCalledWith(memberId);
  });

  test("requires authentication", async () => {
    const { app, service } = setup(null);
    expect((await request(app).get("/api/members/me/membership")).status).toBe(401);
    expect(service.getOwnMembership).not.toHaveBeenCalled();
  });

  test.each(["TRAINER", "ADMIN"] as const)("rejects the %s role", async (role) => {
    const { app, service } = setup(role);
    expect((await request(app).get("/api/members/me/membership")).status).toBe(403);
    expect(service.getOwnMembership).not.toHaveBeenCalled();
  });

  test("requires the temporary password to be changed", async () => {
    const { app, service } = setup("MEMBER", true);
    const response = await request(app).get("/api/members/me/membership");
    expect(response.status).toBe(403);
    expect(response.body.code).toBe(ERROR_CODE.PASSWORD_CHANGE_REQUIRED);
    expect(service.getOwnMembership).not.toHaveBeenCalled();
  });
});
