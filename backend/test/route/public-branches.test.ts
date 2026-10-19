import express, { type RequestHandler } from "express";
import request from "supertest";

import { BranchController } from "../../src/controller/branch-controller.js";
import { ApplicationError } from "../../src/error/application-error.js";
import { ERROR_CODE } from "../../src/error/error-code.js";
import { Prisma } from "../../src/generated/prisma/client.js";
import { errorMiddleware } from "../../src/middleware/error-middleware.js";
import { createBranchRouter } from "../../src/route/branch-route.js";
import type { BranchService } from "../../src/service/branch-service.js";

const branchId = "83cd902e-0475-4c92-943c-129b751dacee";
const card = {
  id: branchId,
  name: "Sede Centro",
  imageUrl: "https://example.com/branch.jpg",
  address: "Calle 123",
  openingHours: "Lunes a viernes de 8 a 22",
  phone: "+54 11 1234 5678",
  description: "Sala de entrenamiento",
};

function setup() {
  const service = {
    listPublicBranches: jest.fn().mockResolvedValue({ items: [card], page: 2, limit: 1, total: 3 }),
    getPublicBranch: jest.fn().mockResolvedValue({
      ...card,
      latitude: new Prisma.Decimal("-34.603722"),
      longitude: new Prisma.Decimal("-58.381592"),
      scheduledClasses: [{
        id: "f12101a5-e6ab-43f7-91b3-2b8fbfd67b84",
        activity: "Yoga",
        startsAt: new Date("2026-10-05T13:00:00.000Z"),
        trainer: { id: "e05a6f56-6db7-4be2-8a90-ce63830af177",
          firstName: "Ana", lastName: "López" },
      }],
    }),
  };
  const authenticate: RequestHandler = jest.fn((_req, _res, next) => next());
  const requireCompletedPasswordChange: RequestHandler = jest.fn((_req, _res, next) => next());
  const app = express();
  app.use(express.json());
  app.use("/api", createBranchRouter(new BranchController(service as unknown as BranchService),
    authenticate, requireCompletedPasswordChange));
  app.use(errorMiddleware);
  return { app, service, authenticate, requireCompletedPasswordChange };
}

describe("public branches", () => {
  test("lists branch cards without authentication and parses search and pagination", async () => {
    const { app, service, authenticate, requireCompletedPasswordChange } = setup();
    const response = await request(app).get("/api/branches")
      .query({ search: "  centro  ", page: "2", limit: "1" });
    expect(response.status).toBe(200);
    expect(service.listPublicBranches).toHaveBeenCalledWith({ search: "centro", page: 2, limit: 1 });
    expect(response.body).toEqual({ items: [card], page: 2, limit: 1, total: 3 });
    expect(authenticate).not.toHaveBeenCalled();
    expect(requireCompletedPasswordChange).not.toHaveBeenCalled();
  });

  test.each([{ search: " " }, { page: "0" }, { limit: "101" }, { extra: "value" }])(
    "rejects invalid list query %p", async (query) => {
      const { app, service } = setup();
      expect((await request(app).get("/api/branches").query(query)).status).toBe(400);
      expect(service.listPublicBranches).not.toHaveBeenCalled();
    },
  );

  test("returns branch detail, coordinates and associated classes without authentication", async () => {
    const { app, authenticate, service } = setup();
    const response = await request(app).get(`/api/branches/${branchId}`);
    expect(response.status).toBe(200);
    expect(service.getPublicBranch).toHaveBeenCalledWith(branchId);
    expect(response.body).toEqual({
      ...card,
      latitude: "-34.603722",
      longitude: "-58.381592",
      scheduledClasses: [{
        id: "f12101a5-e6ab-43f7-91b3-2b8fbfd67b84",
        activity: "Yoga",
        startsAt: "2026-10-05T13:00:00.000Z",
        trainer: { id: "e05a6f56-6db7-4be2-8a90-ce63830af177",
          firstName: "Ana", lastName: "López" },
      }],
    });
    expect(authenticate).not.toHaveBeenCalled();
  });

  test("returns an empty class collection and null coordinates when absent", async () => {
    const { app, service } = setup();
    service.getPublicBranch.mockResolvedValue({
      ...card, latitude: null, longitude: null, scheduledClasses: [],
    });
    const response = await request(app).get(`/api/branches/${branchId}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ...card, latitude: null, longitude: null, scheduledClasses: [] });
  });

  test("rejects invalid ids and returns 404 for unavailable branches", async () => {
    const { app, service } = setup();
    expect((await request(app).get("/api/branches/not-an-id")).status).toBe(400);
    expect(service.getPublicBranch).not.toHaveBeenCalled();
    service.getPublicBranch.mockRejectedValue(new ApplicationError(
      404, ERROR_CODE.NOT_FOUND, "La sede no existe",
    ));
    expect((await request(app).get(`/api/branches/${branchId}`)).status).toBe(404);
  });

  test("keeps administrative writes protected", async () => {
    const { app, authenticate } = setup();
    expect((await request(app).post("/api/branches").send({})).status).toBe(401);
    expect(authenticate).toHaveBeenCalled();
  });
});
