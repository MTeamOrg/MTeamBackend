import express, { type RequestHandler } from "express";
import request from "supertest";

import { PaymentController } from "../../src/controller/payment-controller.js";
import { ApplicationError } from "../../src/error/application-error.js";
import { ERROR_CODE } from "../../src/error/error-code.js";
import type { UserRole } from "../../src/generated/prisma/client.js";
import { errorMiddleware } from "../../src/middleware/error-middleware.js";
import { requirePasswordChangeCompleted } from "../../src/middleware/password-change-middleware.js";
import { createPaymentRouter } from "../../src/route/payment-route.js";
import type { PaymentService } from "../../src/service/payment-service.js";

const paymentId = "83cd902e-0475-4c92-943c-129b751dacee";
const administratorId = "212a6da6-063c-44c9-b63c-1d67602cb487";

function setup(role: UserRole | null = "ADMIN", passwordChangeRequired = false) {
  const service = {
    voidPayment: jest.fn().mockResolvedValue({
      id: paymentId, status: "VOIDED", amount: { toString: () => "18000.00" },
      accreditedAt: new Date("2026-09-01T12:00:00.000Z"),
      voidedAt: new Date("2026-09-24T12:00:00.000Z"),
      voidedById: administratorId, voidReason: "Pago duplicado",
    }),
  };
  const authenticate: RequestHandler = (req, _res, next) => {
    if (!role) throw new ApplicationError(401, ERROR_CODE.UNAUTHORIZED, "Authentication required");
    req.authenticatedUser = { id: administratorId, role, isPasswordChangeRequired: passwordChangeRequired };
    next();
  };
  const app = express();
  app.use(express.json());
  app.use("/api", createPaymentRouter(new PaymentController(service as unknown as PaymentService),
    authenticate, requirePasswordChangeCompleted));
  app.use(errorMiddleware);
  return { app, service };
}

describe("POST /api/payments/{paymentId}/voids", () => {
  test("an administrator can void a payment with a trimmed reason", async () => {
    const { app, service } = setup();
    const response = await request(app).post(`/api/payments/${paymentId}/voids`)
      .send({ reason: "  Pago duplicado  " });

    expect(response.status).toBe(200);
    expect(service.voidPayment).toHaveBeenCalledWith(paymentId, "Pago duplicado", administratorId);
    expect(response.body).toMatchObject({ id: paymentId, status: "VOIDED",
      amount: "18000.00", voidedById: administratorId, voidReason: "Pago duplicado" });
  });

  test.each([
    {}, { reason: "  " }, { reason: "x".repeat(501) },
    { reason: "Pago duplicado", confirmation: true },
  ])("rejects an invalid body %p", async (body) => {
    const { app, service } = setup();
    expect((await request(app).post(`/api/payments/${paymentId}/voids`).send(body)).status).toBe(400);
    expect(service.voidPayment).not.toHaveBeenCalled();
  });

  test("rejects an invalid payment id", async () => {
    const { app, service } = setup();
    expect((await request(app).post("/api/payments/not-a-uuid/voids")
      .send({ reason: "Pago duplicado" })).status).toBe(400);
    expect(service.voidPayment).not.toHaveBeenCalled();
  });

  test.each([
    [404, ERROR_CODE.NOT_FOUND, "El pago no existe"],
    [409, ERROR_CODE.CONFLICT, "El pago ya fue anulado"],
  ])("returns %i with a clear message", async (status, code, message) => {
    const { app, service } = setup();
    service.voidPayment.mockRejectedValue(new ApplicationError(status, code, message));
    const response = await request(app).post(`/api/payments/${paymentId}/voids`)
      .send({ reason: "Pago duplicado" });
    expect(response.status).toBe(status);
    expect(response.body).toMatchObject({ code, message });
  });

  test.each([
    [null, false, 401], ["MEMBER", false, 403], ["TRAINER", false, 403],
    ["ADMIN", true, 403],
  ] as const)("enforces role %s and pending password %s", async (role, pending, status) => {
    const { app, service } = setup(role, pending);
    expect((await request(app).post(`/api/payments/${paymentId}/voids`)
      .send({ reason: "Pago duplicado" })).status).toBe(status);
    expect(service.voidPayment).not.toHaveBeenCalled();
  });
});
