import express, { type RequestHandler } from "express";
import request from "supertest";

import { MembershipPriceController } from "../../src/controller/membership-price-controller.js";
import { ApplicationError } from "../../src/error/application-error.js";
import { ERROR_CODE } from "../../src/error/error-code.js";
import type { UserRole } from "../../src/generated/prisma/client.js";
import { errorMiddleware } from "../../src/middleware/error-middleware.js";
import { requirePasswordChangeCompleted } from "../../src/middleware/password-change-middleware.js";
import { createMembershipPriceRouter } from "../../src/route/membership-price-route.js";
import type { MembershipPriceService } from "../../src/service/membership-price-service.js";

const administratorId = "a69a0192-a9a9-4936-8c79-bc5ff13d8dc2";
const futureEffectiveFrom = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const price = {
  id: "30000000-0000-0000-0000-000000000003",
  amount: { toString: () => "20000.00" },
  effectiveFrom: new Date(futureEffectiveFrom),
  createdAt: new Date("2026-09-24T12:00:00.000Z"),
  createdById: administratorId,
};

function setup(role: UserRole | null, isPasswordChangeRequired = false) {
  const service = {
    createPrice: jest.fn().mockResolvedValue({ ...price, previousAmount: "18000.00" }),
    getCurrentPrice: jest.fn().mockResolvedValue(price),
    listPrices: jest.fn().mockResolvedValue({
      items: [{ ...price, previousAmount: "18000.00" }],
      page: 2,
      limit: 1,
      total: 3,
    }),
  };
  const authenticate: RequestHandler = (request, _response, next) => {
    if (!role) throw new ApplicationError(401, ERROR_CODE.UNAUTHORIZED, "Authentication required");
    request.authenticatedUser = { id: administratorId, role, isPasswordChangeRequired };
    next();
  };
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createMembershipPriceRouter(
      new MembershipPriceController(service as unknown as MembershipPriceService),
      authenticate,
      requirePasswordChangeCompleted,
    ),
  );
  app.use(errorMiddleware);
  return { app, service };
}

describe("membership price routes", () => {
  test("an administrator can add a scheduled price without replacing the previous value", async () => {
    const { app, service } = setup("ADMIN");
    const input = { amount: 20000, effectiveFrom: futureEffectiveFrom };
    const response = await request(app).post("/api/membership-prices").send(input);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      ...price,
      amount: "20000.00",
      previousAmount: "18000.00",
      effectiveFrom: price.effectiveFrom.toISOString(),
      createdAt: price.createdAt.toISOString(),
    });
    expect(service.createPrice).toHaveBeenCalledWith(input, administratorId);
  });

  test("an administrator can page through the price history", async () => {
    const { app, service } = setup("ADMIN");
    const response = await request(app).get("/api/membership-prices?page=2&limit=1");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [{
        ...price,
        amount: "20000.00",
        previousAmount: "18000.00",
        effectiveFrom: price.effectiveFrom.toISOString(),
        createdAt: price.createdAt.toISOString(),
      }],
      page: 2,
      limit: 1,
      total: 3,
    });
    expect(service.listPrices).toHaveBeenCalledWith({ page: 2, limit: 1 });
  });

  test("history defaults to the project's page size", async () => {
    const { app, service } = setup("ADMIN");
    expect((await request(app).get("/api/membership-prices")).status).toBe(200);
    expect(service.listPrices).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  test("the current price remains available to an authenticated member", async () => {
    const { app, service } = setup("MEMBER");
    const response = await request(app).get("/api/membership-prices/current");

    expect(response.status).toBe(200);
    expect(response.body.amount).toBe("20000.00");
    expect(service.getCurrentPrice).toHaveBeenCalledTimes(1);
  });

  test.each(["post", "get"] as const)("%s /api/membership-prices requires an administrator", async (method) => {
    const { app, service } = setup("MEMBER");
    const response = method === "post"
      ? await request(app).post("/api/membership-prices").send({ amount: 20000, effectiveFrom: futureEffectiveFrom })
      : await request(app).get("/api/membership-prices");

    expect(response.status).toBe(403);
    expect(service.createPrice).not.toHaveBeenCalled();
    expect(service.listPrices).not.toHaveBeenCalled();
  });

  test("history requires authentication and a completed password change", async () => {
    expect((await request(setup(null).app).get("/api/membership-prices")).status).toBe(401);
    const response = await request(setup("ADMIN", true).app).get("/api/membership-prices");
    expect(response.status).toBe(403);
    expect(response.body.code).toBe(ERROR_CODE.PASSWORD_CHANGE_REQUIRED);
  });

  test("rejects invalid pagination and price input", async () => {
    const { app, service } = setup("ADMIN");
    expect((await request(app).get("/api/membership-prices?page=0")).status).toBe(400);
    expect((await request(app).get("/api/membership-prices?limit=101")).status).toBe(400);
    expect((await request(app).post("/api/membership-prices").send({ amount: -1, effectiveFrom: futureEffectiveFrom })).status).toBe(400);
    expect(service.listPrices).not.toHaveBeenCalled();
    expect(service.createPrice).not.toHaveBeenCalled();
  });
});
