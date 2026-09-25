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

const ownId = "83cd902e-0475-4c92-943c-129b751dacee";
const otherId = "212a6da6-063c-44c9-b63c-1d67602cb487";

const accreditedAt = new Date("2026-09-01T12:30:00.000Z");
const expiresAt = new Date("2026-10-01T12:30:00.000Z");
const voidedAt = new Date("2026-09-24T14:00:00.000Z");

const voidedPayment = {
  id: "0960f917-a57c-4d6d-9602-eef746269b95",
  accreditedAt,
  amount: new Prisma.Decimal("1234567890.12"),
  method: "transferencia",
  receiptNumber: "REC-123",
  status: "VOIDED",
  expiresAt,
  voidedAt,
  voidReason: "Pago duplicado",
};

function setup(role: UserRole | null, result = { items: [voidedPayment], page: 2, limit: 1, total: 3 },
  passwordChangeRequired = false) {
  const service = { listMemberPayments: jest.fn().mockResolvedValue(result) };
  const authenticate: RequestHandler = (req, _res, next) => {
    if (!role) throw new ApplicationError(401, ERROR_CODE.UNAUTHORIZED, "Authentication required");
    req.authenticatedUser = {
      id: role === "ADMIN" ? otherId : ownId, role, isPasswordChangeRequired: passwordChangeRequired,
    };
    next();
  };
  const app = express();
  app.use("/api", createPaymentRouter(new PaymentController(service as unknown as PaymentService),
    authenticate, requirePasswordChangeCompleted));
  app.use(errorMiddleware);
  return { app, service };
}

describe("PAG-03 payment history routes", () => {
  test("a member sees only their own history, including original data of voided payments", async () => {
    const { app, service } = setup("MEMBER");
    const response = await request(app).get("/api/members/me/payments")
      .query({ page: "2", limit: "1" });

    expect(response.status).toBe(200);
    expect(service.listMemberPayments).toHaveBeenCalledWith(ownId, { page: 2, limit: 1 });
    expect(response.body).toEqual({
      page: 2, limit: 1, total: 3,
      items: [{
        id: voidedPayment.id,
        accreditedAt: accreditedAt.toISOString(),
        amount: "1234567890.12",
        method: "transferencia",
        receiptNumber: "REC-123",
        status: "VOIDED",
        expiresAt: expiresAt.toISOString(),
        voidedAt: voidedAt.toISOString(),
        voidReason: "Pago duplicado",
      }],
    });
  });

  test("an administrator can select a member while a member cannot read another member's path", async () => {
    const admin = setup("ADMIN");
    const response = await request(admin.app).get(`/api/members/${ownId}/payments`);
    expect(response.status).toBe(200);
    expect(admin.service.listMemberPayments).toHaveBeenCalledWith(ownId, { page: 1, limit: 20 });

    const member = setup("MEMBER");
    expect((await request(member.app).get(`/api/members/${otherId}/payments`)).status).toBe(403);
    expect(member.service.listMemberPayments).not.toHaveBeenCalled();
    expect((await request(admin.app).get("/api/members/me/payments")).status).toBe(403);
  });

  test("returns an empty page with total zero", async () => {
    const { app } = setup("MEMBER", { items: [], page: 1, limit: 20, total: 0 });
    expect((await request(app).get("/api/members/me/payments")).body)
      .toEqual({ items: [], page: 1, limit: 20, total: 0 });
  });

  test("keeps accredited and voided records distinct, including absent receipt and void data", async () => {
    const accreditedPayment = {
      ...voidedPayment,
      id: "d0d7ffda-0e30-4148-866d-f9354af5224c",
      status: "ACCREDITED",
      receiptNumber: null,
      voidedAt: null,
      voidReason: null,
    };
    const { app } = setup("MEMBER", {
      items: [voidedPayment, accreditedPayment], page: 1, limit: 20, total: 2,
    });
    const response = await request(app).get("/api/members/me/payments");
    expect(response.body.items.map((item: { status: string }) => item.status))
      .toEqual(["VOIDED", "ACCREDITED"]);
    expect(response.body.items[1]).toMatchObject({
      receiptNumber: null, voidedAt: null, voidReason: null,
      amount: "1234567890.12", expiresAt: expiresAt.toISOString(),
    });
  });

  test.each([
    { page: "0" }, { page: "1.5" }, { limit: "0" }, { limit: "101" },
    { status: "VOIDED" },
  ])("rejects unsupported pagination %p", async (query) => {
    const { app, service } = setup("MEMBER");
    expect((await request(app).get("/api/members/me/payments").query(query)).status).toBe(400);
    expect(service.listMemberPayments).not.toHaveBeenCalled();
  });

  test("rejects an invalid member identifier", async () => {
    const { app, service } = setup("ADMIN");
    expect((await request(app).get("/api/members/not-a-uuid/payments")).status).toBe(400);
    expect(service.listMemberPayments).not.toHaveBeenCalled();
  });

  test.each([
    [null, "/api/members/me/payments", 401],
    ["TRAINER", "/api/members/me/payments", 403],
    ["MEMBER", `/api/members/${otherId}/payments`, 403],
    [null, `/api/members/${otherId}/payments`, 401],
    ["TRAINER", `/api/members/${otherId}/payments`, 403],
  ] as const)("enforces role %s on %s", async (role, path, status) => {
    const { app, service } = setup(role);
    expect((await request(app).get(path)).status).toBe(status);
    expect(service.listMemberPayments).not.toHaveBeenCalled();
  });

  test("requires temporary password change", async () => {
    const { app, service } = setup("MEMBER", undefined, true);
    expect((await request(app).get("/api/members/me/payments")).status).toBe(403);
    expect(service.listMemberPayments).not.toHaveBeenCalled();
  });
});
