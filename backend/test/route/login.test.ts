import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";

import { AuthController } from "../../src/controller/auth-controller.js";
import { errorMiddleware } from "../../src/middleware/error-middleware.js";
import type { AuthenticationUser, UserRepositoryPort } from "../../src/repository/user-repository.js";
import { createAuthRouter } from "../../src/route/auth-route.js";
import { healthRouter } from "../../src/route/health-route.js";
import { AuthService } from "../../src/service/auth-service.js";
import { PasswordService } from "../../src/service/password-service.js";
import { TokenService } from "../../src/service/token-service.js";

jest.mock("../../src/config/environment.js", () => ({ environment: { APP_ENV: "test" } }));

const secret = "fictional-jwt-secret-exclusive-to-tests";
const password = "test-password";
let user: AuthenticationUser;

beforeAll(async () => {
  user = {
    id: "83cd902e-0475-4c92-943c-129b751dacee",
    firstName: "Lara", lastName: "Frenkel", email: "lara@example.com",
    passwordHash: await new PasswordService().hash(password),
    role: "MEMBER", status: "ACTIVE", isPasswordChangeRequired: false,
  };
});

function setup() {
  const repository: jest.Mocked<UserRepositoryPort> = {
    findByEmail: jest.fn().mockResolvedValue(user),
    findConflict: jest.fn().mockResolvedValue(null),
    createMember: jest.fn().mockResolvedValue({
      ...user, passwordHash: undefined, documentNumber: "12345678",
      birthDate: new Date("2000-05-20T00:00:00.000Z"), phone: "1122334455", photoUrl: null,
    }),
  };
  const service = new AuthService(repository, new PasswordService(), new TokenService(secret, 3600));
  const app = express();
  app.use(express.json());
  app.use("/api", createAuthRouter(new AuthController(service)));
  app.use("/api", healthRouter);
  app.use(errorMiddleware);
  return { app, repository };
}

describe("POST /api/auth/login", () => {
  test("returns a safe response and a signed, expiring JWT after normalizing email", async () => {
    const { app, repository } = setup();
    const before = Math.floor(Date.now() / 1000);
    const response = await request(app).post("/api/auth/login").send({ email: " LARA@EXAMPLE.COM ", password });
    expect(response.status).toBe(200);
    expect(repository.findByEmail).toHaveBeenCalledWith(user.email);
    const { passwordHash: _passwordHash, ...safeUser } = user;
    expect(response.body).toEqual({ accessToken: expect.any(String), tokenType: "Bearer", expiresIn: 3600, user: safeUser });
    const claims = jwt.verify(response.body.accessToken, secret, { algorithms: ["HS256"] }) as jwt.JwtPayload;
    expect(Object.keys(claims).sort()).toEqual(["exp", "role", "sub"]);
    expect(claims.sub).toBe(user.id);
    expect(claims.role).toBe(user.role);
    expect(claims.exp).toBeGreaterThanOrEqual(before + 3600);
    expect(claims.exp).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 3600);
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    expect(() => jwt.verify(response.body.accessToken, "different-test-secret")).toThrow();
    expect(() => jwt.verify(response.body.accessToken, secret, { clockTimestamp: claims.exp! })).toThrow(jwt.TokenExpiredError);
  });

  test("returns exactly the same 401 for an unknown email and an incorrect password", async () => {
    const { app, repository } = setup();
    repository.findByEmail.mockResolvedValueOnce(null);
    const missing = await request(app).post("/api/auth/login").send({ email: "missing@example.com", password });
    const wrong = await request(app).post("/api/auth/login").send({ email: user.email, password: "wrong" });
    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(missing.body).toEqual(wrong.body);
    expect(wrong.body).toEqual({ code: "INVALID_CREDENTIALS", message: "Correo electrónico o contraseña incorrectos", details: null });
  });

  test("returns 403 for inactive accounts with a valid password", async () => {
    const { app, repository } = setup();
    repository.findByEmail.mockResolvedValue({ ...user, status: "INACTIVE" });
    const response = await request(app).post("/api/auth/login").send({ email: user.email, password });
    expect(response.status).toBe(403);
    expect(response.body).toEqual({ code: "ACCOUNT_INACTIVE", message: "La cuenta se encuentra inactiva", details: null });
  });

  test.each([
    { email: "invalid", password },
    { email: "lara@example.com", password: "" },
    { email: "lara@example.com", password, role: "ADMIN" },
    { email: "lara@example.com" },
    { password },
    { email: 123, password },
    { email: "lara@example.com", password: 123 },
  ])("rejects an invalid request: %j", async (body) => {
    const { app, repository } = setup();
    const response = await request(app).post("/api/auth/login").send(body);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ code: "VALIDATION_ERROR", message: "Los datos de inicio de sesión no son válidos", details: expect.any(Object) });
    expect(repository.findByEmail).not.toHaveBeenCalled();
  });

  test("accepts a previously valid password without imposing complexity or trimming", async () => {
    const { app, repository } = setup();
    repository.findByEmail.mockResolvedValue({ ...user, passwordHash: await new PasswordService().hash(" p ") });
    const response = await request(app).post("/api/auth/login").send({ email: user.email, password: " p " });
    expect(response.status).toBe(200);
  });

  test("registration and health remain available on the same router setup", async () => {
    const { app } = setup();
    const registration = await request(app).post("/api/auth/register").send({
      firstName: "Lara", lastName: "Frenkel", documentNumber: "12345678",
      birthDate: "2000-05-20", email: user.email, phone: "1122334455", password,
    });
    expect(registration.status).toBe(201);
    expect(registration.body).not.toHaveProperty("passwordHash");
    const health = await request(app).get("/api/health");
    expect(health.status).toBe(200);
    expect(health.body).toEqual({ status: "ok", environment: "test" });
  });
});
