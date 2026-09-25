import express, { type RequestHandler } from "express";
import request from "supertest";

import { MemberController } from "../../src/controller/member-controller.js";
import { ApplicationError } from "../../src/error/application-error.js";
import { ERROR_CODE } from "../../src/error/error-code.js";
import type { UserRole } from "../../src/generated/prisma/client.js";
import { errorMiddleware } from "../../src/middleware/error-middleware.js";
import { requirePasswordChangeCompleted } from "../../src/middleware/password-change-middleware.js";
import { createMemberRouter } from "../../src/route/member-route.js";
import type { MemberService } from "../../src/service/member-service.js";

function setup(role: UserRole | null = "ADMIN", passwordChangeRequired = false) {
  const service = {
    listMembers: jest.fn().mockResolvedValue({
      items: [{
        id: "83cd902e-0475-4c92-943c-129b751dacee",
        firstName: "Lara", lastName: "Frenkel", documentNumber: "12345678",
        email: "lara@example.com", status: "INACTIVE", membershipStatus: "CURRENT",
        lastPaymentAt: new Date("2026-09-20T12:00:00.000Z"),
        expiresAt: new Date("2026-10-20T12:00:00.000Z"),
      }],
      page: 2, limit: 10, total: 11,
    }),
  };
  const authenticate: RequestHandler = (req, _res, next) => {
    if (!role) throw new ApplicationError(401, ERROR_CODE.UNAUTHORIZED, "Authentication required");
    req.authenticatedUser = {
      id: "212a6da6-063c-44c9-b63c-1d67602cb487", role,
      isPasswordChangeRequired: passwordChangeRequired,
    };
    next();
  };
  const app = express();
  app.use("/api", createMemberRouter(new MemberController(service as unknown as MemberService),
    authenticate, requirePasswordChangeCompleted));
  app.use(errorMiddleware);
  return { app, service };
}

describe("GET /api/members", () => {
  test("passes search, status and pagination and distinguishes account status", async () => {
    const { app, service } = setup();
    const response = await request(app).get("/api/members")
      .query({ search: " Lara ", membershipStatus: "CURRENT", page: "2", limit: "10" });

    expect(response.status).toBe(200);
    expect(service.listMembers).toHaveBeenCalledWith({
      search: "Lara", membershipStatus: "CURRENT", page: 2, limit: 10,
    });
    expect(response.body).toMatchObject({ page: 2, limit: 10, total: 11,
      items: [{ status: "INACTIVE", membershipStatus: "CURRENT",
        expiresAt: "2026-10-20T12:00:00.000Z" }] });
  });

  test.each(["CURRENT", "EXPIRING_SOON", "EXPIRED"])("accepts %s", async (membershipStatus) => {
    const { app, service } = setup();
    expect((await request(app).get("/api/members").query({ membershipStatus })).status).toBe(200);
    expect(service.listMembers).toHaveBeenCalledWith({ membershipStatus, page: 1, limit: 20 });
  });

  test.each([
    { membershipStatus: "ACTIVE" }, { page: "0" }, { limit: "101" },
    { search: " " }, { role: "MEMBER" },
  ])("rejects invalid filters %p", async (query) => {
    const { app, service } = setup();
    expect((await request(app).get("/api/members").query(query)).status).toBe(400);
    expect(service.listMembers).not.toHaveBeenCalled();
  });

  test.each([
    [null, false, 401], ["MEMBER", false, 403], ["TRAINER", false, 403],
    ["ADMIN", true, 403],
  ] as const)("enforces access for role %s with pending password %s", async (role, pending, status) => {
    const { app, service } = setup(role, pending);
    expect((await request(app).get("/api/members")).status).toBe(status);
    expect(service.listMembers).not.toHaveBeenCalled();
  });
});
