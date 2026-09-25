import express, { type RequestHandler } from "express";
import request from "supertest";

import { PaymentController } from "../../src/controller/payment-controller.js";
import { ApplicationError } from "../../src/error/application-error.js";
import { ERROR_CODE } from "../../src/error/error-code.js";
import { Prisma, type UserRole } from "../../src/generated/prisma/client.js";
import { errorMiddleware } from "../../src/middleware/error-middleware.js";
import { requirePasswordChangeCompleted } from "../../src/middleware/password-change-middleware.js";
import { createPaymentRouter } from "../../src/route/payment-route.js";
import type { PaymentService } from "../../src/service/payment-service.js";

const memberId = "83cd902e-0475-4c92-943c-129b751dacee";
const from = "2026-09-01T00:00:00.000Z";
const to = "2026-10-01T00:00:00.000Z";
const payment = {
  id: "0960f917-a57c-4d6d-9602-eef746269b95",
  accreditedAt: new Date("2026-09-24T12:00:00.000Z"),
  amount: new Prisma.Decimal("1234567890.12"),
  method: "transferencia", receiptNumber: "REC-123", status: "VOIDED",
  expiresAt: new Date("2026-10-24T12:00:00.000Z"),
  voidedAt: new Date("2026-09-25T12:00:00.000Z"), voidReason: "Pago duplicado",
  member: { id: memberId, firstName: "Lara", lastName: "Frenkel",
    documentNumber: "12345678", email: "lara@example.com" },
};

function setup(role: UserRole | null = "ADMIN", passwordChangeRequired = false) {
  const service = {
    listPayments: jest.fn().mockResolvedValue({ items: [payment], page: 2, limit: 1, total: 3 }),
    getPaymentsSummary: jest.fn().mockResolvedValue({
      from: new Date(from), to: new Date(to), paymentCount: 2, totalAmount: "30000.25",
    }),
  };
  const authenticate: RequestHandler = (req, _res, next) => {
    if (!role) throw new ApplicationError(401, ERROR_CODE.UNAUTHORIZED, "Authentication required");
    req.authenticatedUser = { id: "212a6da6-063c-44c9-b63c-1d67602cb487",
      role, isPasswordChangeRequired: passwordChangeRequired };
    next();
  };
  const app = express();
  app.use("/api", createPaymentRouter(new PaymentController(service as unknown as PaymentService),
    authenticate, requirePasswordChangeCompleted));
  app.use(errorMiddleware);
  return { app, service };
}

describe("PAG-04 payment listing", () => {
  test("combines filters, paginates and serializes voided payments with exact amounts", async () => {
    const { app, service } = setup();
    const response = await request(app).get("/api/payments").query({
      memberId, documentNumber: " 1234 ", from, to,
      method: " transferencia ", status: "VOIDED", page: "2", limit: "1",
    });
    expect(response.status).toBe(200);
    expect(service.listPayments).toHaveBeenCalledWith({
      memberId, documentNumber: "1234", from, to,
      method: "transferencia", status: "VOIDED", page: 2, limit: 1,
    });
    expect(response.body).toEqual({ items: [{
      ...payment,
      amount: "1234567890.12",
      accreditedAt: "2026-09-24T12:00:00.000Z",
      expiresAt: "2026-10-24T12:00:00.000Z",
      voidedAt: "2026-09-25T12:00:00.000Z",
    }], page: 2, limit: 1, total: 3 });
  });

  test.each([
    { memberId: "not-uuid" }, { documentNumber: " " }, { method: " " },
    { status: "PENDING" }, { page: "0" }, { limit: "101" },
    { from: "2026-09-01" }, { to: "bad-date" },
    { from: to, to: from }, { from, to: from },
    { unknown: "value" },
  ])("rejects invalid filters %p", async (query) => {
    const { app, service } = setup();
    expect((await request(app).get("/api/payments").query(query)).status).toBe(400);
    expect(service.listPayments).not.toHaveBeenCalled();
  });
});

describe("PAG-07 payment summary", () => {
  test("routes summary before any payment identifier and returns the aggregate", async () => {
    const { app, service } = setup();
    const response = await request(app).get("/api/payments/summary").query({ from, to });
    expect(response.status).toBe(200);
    expect(service.getPaymentsSummary).toHaveBeenCalledWith({ from, to });
    expect(service.listPayments).not.toHaveBeenCalled();
    expect(response.body).toEqual({ from, to, paymentCount: 2, totalAmount: "30000.25" });
  });

  test.each([
    {}, { from }, { to }, { from: "invalid", to }, { from, to: "invalid" },
    { from: to, to: from }, { from, to: from }, { from, to, page: "1" },
  ])("rejects an invalid range %p", async (query) => {
    const { app, service } = setup();
    expect((await request(app).get("/api/payments/summary").query(query)).status).toBe(400);
    expect(service.getPaymentsSummary).not.toHaveBeenCalled();
  });
});

describe("administrative report permissions", () => {
  test.each([
    [null, false, 401], ["MEMBER", false, 403], ["TRAINER", false, 403],
    ["ADMIN", true, 403],
  ] as const)("enforces role %s and pending password %s", async (role, pending, status) => {
    const { app, service } = setup(role, pending);
    expect((await request(app).get("/api/payments")).status).toBe(status);
    expect((await request(app).get("/api/payments/summary").query({ from, to })).status)
      .toBe(status);
    expect(service.listPayments).not.toHaveBeenCalled();
    expect(service.getPaymentsSummary).not.toHaveBeenCalled();
  });
});
