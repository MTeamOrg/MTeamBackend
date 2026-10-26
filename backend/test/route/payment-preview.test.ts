import express, { type RequestHandler } from "express";
import request from "supertest";

import { PaymentPreviewController } from "../../src/controller/payment-preview-controller.js";
import { ApplicationError } from "../../src/error/application-error.js";
import { ERROR_CODE } from "../../src/error/error-code.js";
import type { UserRole } from "../../src/generated/prisma/client.js";
import { errorMiddleware } from "../../src/middleware/error-middleware.js";
import { requirePasswordChangeCompleted } from "../../src/middleware/password-change-middleware.js";
import { createPaymentPreviewRouter } from "../../src/route/payment-preview-route.js";
import type { PaymentPreviewService } from "../../src/service/payment-preview-service.js";

const memberId = "83cd902e-0475-4c92-943c-129b751dacee";
const body = { memberId, amount: 20000.25, method: "transferencia", receiptNumber: "REC-1" };

function setup(role: UserRole | null = "ADMIN", passwordChangeRequired = false) {
  const service = {
    previewPayment: jest.fn().mockResolvedValue({
      member: { id: memberId, firstName: "Lara", lastName: "Frenkel",
        documentNumber: "12345678", email: "lara@example.com" },
      currentPrice: "18000.00", amount: "20000.25", method: "transferencia",
      receiptNumber: "REC-1",
      estimatedAccreditedAt: new Date("2026-09-25T12:00:00.000Z"),
      estimatedExpiresAt: new Date("2026-10-25T12:00:00.000Z"),
    }),
  };
  const authenticate: RequestHandler = (req, _res, next) => {
    if (!role) throw new ApplicationError(401, ERROR_CODE.UNAUTHORIZED, "Authentication required");
    req.authenticatedUser = { id: "212a6da6-063c-44c9-b63c-1d67602cb487",
      role, isPasswordChangeRequired: passwordChangeRequired };
    next();
  };
  const app = express();
  app.use(express.json());
  app.use("/api", createPaymentPreviewRouter(
    new PaymentPreviewController(service as unknown as PaymentPreviewService),
    authenticate, requirePasswordChangeCompleted,
  ));
  app.use(errorMiddleware);
  return { app, service };
}

describe("POST /api/payments/previews", () => {
  test("returns the estimated summary for an administrator", async () => {
    const { app, service } = setup();
    const response = await request(app).post("/api/payments/previews").send(body);
    expect(response.status).toBe(200);
    expect(service.previewPayment).toHaveBeenCalledWith(body);
    expect(response.body).toEqual({
      member: { id: memberId, firstName: "Lara", lastName: "Frenkel",
        documentNumber: "12345678", email: "lara@example.com" },
      currentPrice: "18000.00", amount: "20000.25", method: "transferencia",
      receiptNumber: "REC-1",
      estimatedAccreditedAt: "2026-09-25T12:00:00.000Z",
      estimatedExpiresAt: "2026-10-25T12:00:00.000Z",
    });
  });

  test.each([
    { ...body, memberId: "invalid" },
    { ...body, amount: 0 },
    { ...body, amount: -1 },
    { ...body, amount: 1.234 },
    { ...body, method: " " },
    { ...body, receiptNumber: "x".repeat(101) },
    { ...body, confirmation: true },
  ])("rejects invalid payment data %p", async (invalidBody) => {
    const { app, service } = setup();
    expect((await request(app).post("/api/payments/previews").send(invalidBody)).status).toBe(400);
    expect(service.previewPayment).not.toHaveBeenCalled();
  });

  test.each([
    [null, false, 401], ["MEMBER", false, 403], ["TRAINER", false, 403],
    ["ADMIN", true, 403],
  ] as const)("enforces role %s and password state %s", async (role, pending, status) => {
    const { app, service } = setup(role, pending);
    expect((await request(app).post("/api/payments/previews").send(body)).status).toBe(status);
    expect(service.previewPayment).not.toHaveBeenCalled();
  });
});
