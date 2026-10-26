import express, { type RequestHandler } from "express";
import request from "supertest";

import { BranchController } from "../../src/controller/branch-controller.js";
import { ApplicationError } from "../../src/error/application-error.js";
import { ERROR_CODE } from "../../src/error/error-code.js";
import { Prisma, type UserRole } from "../../src/generated/prisma/client.js";
import { errorMiddleware } from "../../src/middleware/error-middleware.js";
import { requirePasswordChangeCompleted } from "../../src/middleware/password-change-middleware.js";
import { createBranchRouter } from "../../src/route/branch-route.js";
import type { BranchService } from "../../src/service/branch-service.js";

const branchId = "83cd902e-0475-4c92-943c-129b751dacee";
const branch = {
  id: branchId, name: "Sede Centro", description: "Sala principal",
  imageUrl: "https://example.com/sede.jpg", address: "Calle 123",
  openingHours: "Lunes a viernes 8 a 22", phone: "+54 11 1234 5678",
  latitude: new Prisma.Decimal("-34.603722"),
  longitude: new Prisma.Decimal("-58.381592"), isActive: false,
};
const detail = {
  ...branch,
  scheduledClasses: [{ id: "f12101a5-e6ab-43f7-91b3-2b8fbfd67b84",
    activity: "Yoga", startsAt: new Date("2026-10-05T13:00:00.000Z"), trainer: null }],
};

function setup(role: UserRole | null = "ADMIN", passwordChangeRequired = false) {
  const service = {
    listAdminBranches: jest.fn().mockResolvedValue({ items: [branch], page: 2, limit: 1, total: 3 }),
    getAdminBranch: jest.fn().mockResolvedValue(detail),
    updateBranchStatus: jest.fn().mockResolvedValue(branch),
    listPublicBranches: jest.fn().mockResolvedValue({ items: [], page: 1, limit: 20, total: 0 }),
    getPublicBranch: jest.fn().mockRejectedValue(new ApplicationError(
      404, ERROR_CODE.NOT_FOUND, "La sede no existe")),
  };
  const authenticate: RequestHandler = (req, _res, next) => {
    if (!role) throw new ApplicationError(401, ERROR_CODE.UNAUTHORIZED, "Authentication required");
    req.authenticatedUser = { id: "212a6da6-063c-44c9-b63c-1d67602cb487",
      role, isPasswordChangeRequired: passwordChangeRequired };
    next();
  };
  const app = express();
  app.use(express.json());
  app.use("/api", createBranchRouter(new BranchController(service as unknown as BranchService),
    authenticate, requirePasswordChangeCompleted));
  app.use(errorMiddleware);
  return { app, service };
}

describe("SED-06 administrative branch queries", () => {
  test("combines search, inactive filter and pagination for admins", async () => {
    const { app, service } = setup();
    const response = await request(app).get("/api/admin/branches")
      .query({ search: " centro ", isActive: "false", page: "2", limit: "1" });
    expect(response.status).toBe(200);
    expect(service.listAdminBranches).toHaveBeenCalledWith({
      search: "centro", isActive: false, page: 2, limit: 1,
    });
    expect(response.body).toEqual({
      items: [{ ...branch, latitude: "-34.603722", longitude: "-58.381592" }],
      page: 2, limit: 1, total: 3,
    });
  });

  test("shows an inactive branch and its preserved class relation to admins", async () => {
    const { app, service } = setup();
    const response = await request(app).get(`/api/admin/branches/${branchId}`);
    expect(response.status).toBe(200);
    expect(service.getAdminBranch).toHaveBeenCalledWith(branchId);
    expect(response.body).toEqual({
      ...branch, latitude: "-34.603722", longitude: "-58.381592",
      scheduledClasses: [{ ...detail.scheduledClasses[0],
        startsAt: "2026-10-05T13:00:00.000Z" }],
    });
  });

  test("public routes cannot expose inactive branches with a query parameter", async () => {
    const { app, service } = setup();
    expect((await request(app).get("/api/branches").query({ isActive: "false" })).status)
      .toBe(400);
    expect(service.listPublicBranches).not.toHaveBeenCalled();
    expect((await request(app).get(`/api/branches/${branchId}`)).status).toBe(404);
  });

  test.each([
    { isActive: "inactive" }, { isActive: "1" }, { page: "0" },
    { limit: "101" }, { search: " " }, { extra: "x" },
  ])("rejects invalid administrative filters %p", async (query) => {
    const { app, service } = setup();
    expect((await request(app).get("/api/admin/branches").query(query)).status).toBe(400);
    expect(service.listAdminBranches).not.toHaveBeenCalled();
  });

  test("validates the administrative detail id and reports a missing branch", async () => {
    const { app, service } = setup();
    expect((await request(app).get("/api/admin/branches/invalid")).status).toBe(400);
    service.getAdminBranch.mockRejectedValue(new ApplicationError(
      404, ERROR_CODE.NOT_FOUND, "La sede no existe"));
    expect((await request(app).get(`/api/admin/branches/${branchId}`)).status).toBe(404);
  });
});

describe("SED-05 branch status", () => {
  test.each([false, true])("updates isActive to %s", async (isActive) => {
    const { app, service } = setup();
    service.updateBranchStatus.mockResolvedValue({ ...branch, isActive });
    const response = await request(app).patch(`/api/branches/${branchId}/status`).send({ isActive });
    expect(response.status).toBe(200);
    expect(service.updateBranchStatus).toHaveBeenCalledWith(branchId, { isActive });
    expect(response.body).toMatchObject({ id: branchId, isActive });
  });

  test.each([{}, { isActive: "false" }, { isActive: null },
    { isActive: true, name: "other" }])("rejects invalid status %p", async (body) => {
    const { app, service } = setup();
    expect((await request(app).patch(`/api/branches/${branchId}/status`).send(body)).status)
      .toBe(400);
    expect(service.updateBranchStatus).not.toHaveBeenCalled();
  });

  test("validates id and returns 404 for a missing branch", async () => {
    const { app, service } = setup();
    expect((await request(app).patch("/api/branches/invalid/status")
      .send({ isActive: false })).status).toBe(400);
    service.updateBranchStatus.mockRejectedValue(new ApplicationError(
      404, ERROR_CODE.NOT_FOUND, "La sede no existe"));
    expect((await request(app).patch(`/api/branches/${branchId}/status`)
      .send({ isActive: false })).status).toBe(404);
  });
});

describe("branch management permissions", () => {
  test.each([
    [null, false, 401], ["MEMBER", false, 403], ["TRAINER", false, 403],
    ["ADMIN", true, 403],
  ] as const)("requires admin role for %s with pending password %s", async (role, pending, status) => {
    const { app, service } = setup(role, pending);
    expect((await request(app).get("/api/admin/branches")).status).toBe(status);
    expect((await request(app).get(`/api/admin/branches/${branchId}`)).status).toBe(status);
    expect((await request(app).patch(`/api/branches/${branchId}/status`)
      .send({ isActive: false })).status).toBe(status);
    expect(service.listAdminBranches).not.toHaveBeenCalled();
    expect(service.getAdminBranch).not.toHaveBeenCalled();
    expect(service.updateBranchStatus).not.toHaveBeenCalled();
  });
});
