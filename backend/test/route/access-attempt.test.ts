import express, { type RequestHandler } from "express";
import request from "supertest";

import { AccessAttemptController } from "../../src/controller/access-attempt-controller.js";
import { ApplicationError } from "../../src/error/application-error.js";
import { ERROR_CODE } from "../../src/error/error-code.js";
import type { UserRole } from "../../src/generated/prisma/client.js";
import { errorMiddleware } from "../../src/middleware/error-middleware.js";
import { requirePasswordChangeCompleted } from "../../src/middleware/password-change-middleware.js";
import { createAccessAttemptRouter } from "../../src/route/access-attempt-route.js";
import type { UserAccessRepositoryPort } from "../../src/repository/user-repository.js";
import type { AccessAttemptService } from "../../src/service/access-attempt-service.js";
import type { TokenVerifier } from "../../src/service/token-service.js";

const memberId = "212a6da6-063c-44c9-b63c-1d67602cb487";
const branchId = "f12101a5-e6ab-43f7-91b3-2b8fbfd67b84";
const accessPointId = "8ee9a7d1-05c3-4c7c-8669-bf2f17ecfdb7";

function setup(role: UserRole | null = "MEMBER", passwordChangeRequired = false) {
  const service = {
    create: jest.fn().mockResolvedValue({
      id: "attempt-id",
      userId: memberId,
      roleAtAttempt: "MEMBER",
      branchId,
      accessPointId,
      result: "ALLOWED",
      denialReason: null,
      attemptedAt: new Date("2026-10-05T12:00:00.000Z"),
      branch: { id: branchId, name: "Belgrano" },
      accessPoint: { id: accessPointId, name: "Molinete 1" },
      user: { id: memberId, email: "member@example.com" },
    }),
    list: jest.fn().mockResolvedValue({ items: [], page: 1, limit: 20, total: 0 }),
  };
  const authenticate: RequestHandler = (req, _response, next) => {
    if (!role) throw new ApplicationError(401, ERROR_CODE.UNAUTHORIZED, "Authentication required");
    req.authenticatedUser = { id: memberId, role, isPasswordChangeRequired: passwordChangeRequired };
    next();
  };
  const users: jest.Mocked<UserAccessRepositoryPort> = {
    findAccessControlUserById: jest.fn().mockResolvedValue(role ? {
      id: memberId, role, status: "ACTIVE", isPasswordChangeRequired: passwordChangeRequired,
    } : null),
  };
  const tokenVerifier: jest.Mocked<TokenVerifier> = {
    verify: jest.fn((token: string) => token === "valid-token" ? { sub: memberId } : null),
  };
  const app = express();
  app.use(express.json());
  app.use("/api", createAccessAttemptRouter(
    new AccessAttemptController(service as unknown as AccessAttemptService),
    authenticate,
    requirePasswordChangeCompleted,
    tokenVerifier,
    users,
  ));
  app.use(errorMiddleware);
  return { app, service, users, tokenVerifier };
}

describe("access attempt routes", () => {
  test("authenticates the scanner, records its QR token, and omits internal user data", async () => {
    const { app, service, users } = setup();
    const response = await request(app)
      .post("/api/access-attempts")
      .set("Authorization", "Bearer valid-token")
      .send({ qrToken: "branch-gate-token" });

    expect(response.status).toBe(201);
    expect(users.findAccessControlUserById).toHaveBeenCalledWith(memberId);
    expect(service.create).toHaveBeenCalledWith(memberId, "branch-gate-token");
    expect(response.body).toMatchObject({ result: "ALLOWED", branchId, accessPointId });
    expect(response.body.user).toBeUndefined();
  });

  test.each([
    ["without a bearer token", undefined, 401],
    ["with an invalid token", "Bearer invalid-token", 401],
    ["with a malformed authorization header", "Basic valid-token", 401],
  ] as const)("rejects a scan %s", async (_description, authorization, status) => {
    const { app, service } = setup();
    const call = request(app).post("/api/access-attempts").send({ qrToken: "branch-gate-token" });
    if (authorization) call.set("Authorization", authorization);
    const response = await call;

    expect(response.status).toBe(status);
    expect(response.body).toMatchObject({ code: ERROR_CODE.UNAUTHORIZED });
    expect(service.create).not.toHaveBeenCalled();
  });

  test.each([
    ["ADMIN", false, 403],
    ["MEMBER", true, 403],
  ] as const)("enforces scanner role and password policy for %s", async (role, passwordChangeRequired, status) => {
    const { app, service } = setup(role, passwordChangeRequired);
    const response = await request(app)
      .post("/api/access-attempts")
      .set("Authorization", "Bearer valid-token")
      .send({ qrToken: "branch-gate-token" });

    expect(response.status).toBe(status);
    expect(service.create).not.toHaveBeenCalled();
  });

  test.each([
    [{}, 400],
    [{ qrToken: "" }, 400],
    [{ qrToken: "valid-token", unexpected: true }, 400],
  ])("rejects an invalid scan payload %p before recording", async (body, status) => {
    const { app, service } = setup();
    const response = await request(app)
      .post("/api/access-attempts")
      .set("Authorization", "Bearer valid-token")
      .send(body);

    expect(response.status).toBe(status);
    expect(response.body.code).toBe(ERROR_CODE.VALIDATION_ERROR);
    expect(service.create).not.toHaveBeenCalled();
  });

  test("lists attempts only through administrator authentication and validates filters", async () => {
    const member = setup("MEMBER");
    expect((await request(member.app).get("/api/access-attempts")).status).toBe(403);
    expect(member.service.list).not.toHaveBeenCalled();

    const admin = setup("ADMIN");
    const response = await request(admin.app).get("/api/access-attempts?result=DENIED&page=2");
    expect(response.status).toBe(200);
    expect(admin.service.list).toHaveBeenCalledWith(expect.objectContaining({ result: "DENIED", page: 2 }));

    const invalidFilter = await request(admin.app).get("/api/access-attempts?result=UNKNOWN");
    expect(invalidFilter.status).toBe(400);
    expect(admin.service.list).toHaveBeenCalledTimes(1);
  });
});
