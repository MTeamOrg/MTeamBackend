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

const memberId = "f846bcd2-c43f-4c08-a523-515b60b1c8a8";
const administratorId = "75f219ab-e396-40e5-b4cc-af0c516d3345";

function setup(role: UserRole | null = "ADMIN", passwordChangeRequired = false) {
  const service = {
    createPayment: jest.fn().mockResolvedValue({
      id: "c4e112b7-d043-454f-adc5-21ec1427eef8",
      memberId,
      amount: { toString: () => "12345.67" },
      method: "TRANSFER",
      receiptNumber: "TEST",
      status: "ACCREDITED",
    }),
  };
  const authenticate: RequestHandler = (request, _response, next) => {
    if (!role) throw new ApplicationError(401, ERROR_CODE.UNAUTHORIZED, "Authentication required");
    request.authenticatedUser = { id: administratorId, role, isPasswordChangeRequired: passwordChangeRequired };
    next();
  };
  const app = express();
  app.use(express.json());
  app.use("/api", createPaymentRouter(
    new PaymentController(service as unknown as PaymentService),
    authenticate,
    requirePasswordChangeCompleted,
  ));
  app.use(errorMiddleware);
  return { app, service };
}

describe("POST /api/payments", () => {
  test("accredits a decimal payment and serializes its amount", async () => {
    const { app, service } = setup();
    const body = { memberId, amount: 12345.67, method: "TRANSFER", receiptNumber: "TEST" };

    const response = await request(app).post("/api/payments").send(body);

    expect(response.status).toBe(201);
    expect(service.createPayment).toHaveBeenCalledWith(body, administratorId);
    expect(response.body).toMatchObject({ amount: "12345.67", status: "ACCREDITED" });
  });

  test.each([
    [{ memberId: "invalid", amount: 10, method: "CASH" }],
    [{ memberId, amount: 0, method: "CASH" }],
    [{ memberId, amount: 10.123, method: "CASH" }],
    [{ memberId, amount: 10, method: "" }],
    [{ memberId, amount: 10, method: "CASH", extra: true }],
  ])("rejects invalid input %p before calling the service", async (body) => {
    const { app, service } = setup();
    expect((await request(app).post("/api/payments").send(body)).status).toBe(400);
    expect(service.createPayment).not.toHaveBeenCalled();
  });

  test.each([
    [null, false, 401],
    ["MEMBER", false, 403],
    ["TRAINER", false, 403],
    ["ADMIN", true, 403],
  ] as const)("enforces role %s and pending password %s", async (role, pending, status) => {
    const { app, service } = setup(role, pending);
    const response = await request(app).post("/api/payments")
      .send({ memberId, amount: 10, method: "CASH" });
    expect(response.status).toBe(status);
    expect(service.createPayment).not.toHaveBeenCalled();
  });
});
