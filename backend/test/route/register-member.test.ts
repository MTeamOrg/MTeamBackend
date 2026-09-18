import express from "express";
import request from "supertest";

import { AuthController } from "../../src/controller/auth-controller.js";
import { errorMiddleware } from "../../src/middleware/error-middleware.js";
import { createAuthRouter } from "../../src/route/auth-route.js";
import type { MemberRegistrationService } from "../../src/service/auth-service.js";

const registeredMember = {
  id: "83cd902e-0475-4c92-943c-129b751dacee",
  firstName: "Lara",
  lastName: "Frenkel",
  documentNumber: "12345678",
  birthDate: new Date("2000-05-20T00:00:00.000Z"),
  email: "lara@example.com",
  phone: "1122334455",
  photoUrl: null,
  role: "MEMBER" as const,
  status: "ACTIVE" as const,
  isPasswordChangeRequired: false,
};

function createTestApp(service: MemberRegistrationService) {
  const app = express();
  app.use(express.json());
  app.use("/api", createAuthRouter(new AuthController(service)));
  app.use(errorMiddleware);
  return app;
}

describe("POST /api/auth/register", () => {
  test("returns 201 without exposing the password", async () => {
    const service: MemberRegistrationService = {
      registerMember: jest.fn().mockResolvedValue(registeredMember),
    };

    const response = await request(createTestApp(service))
      .post("/api/auth/register")
      .send({
        firstName: "Lara",
        lastName: "Frenkel",
        documentNumber: "12345678",
        birthDate: "2000-05-20",
        email: "lara@example.com",
        phone: "1122334455",
        password: "safe-password",
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: registeredMember.id,
      role: "MEMBER",
      status: "ACTIVE",
      birthDate: "2000-05-20",
    });
    expect(response.body).not.toHaveProperty("password");
    expect(response.body).not.toHaveProperty("passwordHash");
  });

  test("returns the uniform validation error for an invalid request", async () => {
    const service: MemberRegistrationService = {
      registerMember: jest.fn(),
    };

    const response = await request(createTestApp(service))
      .post("/api/auth/register")
      .send({ email: "invalid-email", role: "ADMIN" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        code: "VALIDATION_ERROR",
        message: "Los datos de registro no son válidos",
        details: expect.any(Object),
      }),
    );
    expect(service.registerMember).not.toHaveBeenCalled();
  });
});
