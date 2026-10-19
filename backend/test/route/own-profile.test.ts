import express, { type RequestHandler } from "express";
import request from "supertest";

import { UserController } from "../../src/controller/user-controller.js";
import { ApplicationError } from "../../src/error/application-error.js";
import { ERROR_CODE } from "../../src/error/error-code.js";
import { errorMiddleware } from "../../src/middleware/error-middleware.js";
import type { OwnProfile } from "../../src/repository/user-repository.js";
import { createUserRouter } from "../../src/route/user-route.js";
import type { OwnProfileService } from "../../src/service/user-service.js";

const userId = "83cd902e-0475-4c92-943c-129b751dacee";
const profile: OwnProfile = {
  id: userId,
  firstName: "Lara",
  lastName: "Frenkel",
  documentNumber: "12345678",
  birthDate: new Date("2000-05-20T00:00:00.000Z"),
  email: "lara@example.com",
  phone: "1122334455",
  photoUrl: null,
  role: "MEMBER",
  status: "ACTIVE",
  isPasswordChangeRequired: false,
  memberProfile: { emergencyContactName: "Contacto", emergencyContactPhone: "1199999999" },
  trainerProfile: null,
};

function setup(authenticated = true, includePhoto = true) {
  const service: jest.Mocked<OwnProfileService> = {
    getCurrentIdentity: jest.fn().mockResolvedValue(profile),
    getOwnProfile: jest.fn().mockResolvedValue(profile),
    updateOwnProfile: jest.fn().mockResolvedValue(profile),
    updateOwnPhoto: jest.fn().mockResolvedValue({
      ...profile,
      photoUrl: "https://storage.example/profile-photo/user",
    }),
  };
  const authenticate: RequestHandler = (req, _res, next) => {
    if (!authenticated) {
      throw new ApplicationError(401, ERROR_CODE.UNAUTHORIZED, "Se requiere una autenticación válida");
    }
    req.authenticatedUser = {
      id: userId,
      role: "MEMBER",
      isPasswordChangeRequired: false,
    };
    next();
  };
  const app = express();
  app.use(express.json());
  const requireCompletedPasswordChange: RequestHandler = (_req, _res, next) => next();
  const uploadPhoto: RequestHandler = (req, _res, next) => {
    if (includePhoto) {
      req.file = {
        buffer: Buffer.from("photo"),
        mimetype: "image/png",
      } as Express.Multer.File;
    }
    next();
  };
  app.use(
    "/api",
    createUserRouter(
      new UserController(service),
      authenticate,
      requireCompletedPasswordChange,
      uploadPhoto,
    ),
  );
  app.use(errorMiddleware);
  return { app, service };
}

describe("own profile routes", () => {
  test("GET /auth/me returns the current safe identity", async () => {
    const { app, service } = setup();
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(200);
    expect(response.body.birthDate).toBe("2000-05-20");
    expect(response.body).not.toHaveProperty("passwordHash");
    expect(service.getCurrentIdentity).toHaveBeenCalledWith(userId);
  });

  test("GET /users/me returns the role-specific profile", async () => {
    const { app } = setup();
    const response = await request(app).get("/api/users/me");

    expect(response.status).toBe(200);
    expect(response.body.memberProfile).toEqual(profile.memberProfile);
    expect(response.body.trainerProfile).toBeNull();
  });

  test("PUT /users/me/photo updates the authenticated user's photo", async () => {
    const { app, service } = setup();

    const response = await request(app).put("/api/users/me/photo");

    expect(response.status).toBe(200);
    expect(response.body.photoUrl).toBe("https://storage.example/profile-photo/user");
    expect(service.updateOwnPhoto).toHaveBeenCalledWith(userId, {
      buffer: Buffer.from("photo"),
      mimeType: "image/png",
    });
  });

  test("PUT /users/me/photo requires a file", async () => {
    const { app, service } = setup(true, false);

    const response = await request(app).put("/api/users/me/photo");

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(service.updateOwnPhoto).not.toHaveBeenCalled();
  });

  test("PATCH /users/me accepts only editable fields", async () => {
    const { app, service } = setup();
    const response = await request(app).patch("/api/users/me").send({ phone: "1100000000" });

    expect(response.status).toBe(200);
    expect(service.updateOwnProfile).toHaveBeenCalledWith(
      { id: userId, role: "MEMBER", isPasswordChangeRequired: false },
      { phone: "1100000000" },
    );
  });

  test.each([
    {},
    { role: "ADMIN" },
    { documentNumber: "99999999" },
    { status: "INACTIVE" },
    { phone: "" },
  ])("PATCH /users/me rejects invalid or protected fields: %j", async (body) => {
    const { app, service } = setup();
    const response = await request(app).patch("/api/users/me").send(body);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(service.updateOwnProfile).not.toHaveBeenCalled();
  });

  test.each([
    ["get", "/api/auth/me"],
    ["get", "/api/users/me"],
    ["patch", "/api/users/me"],
    ["put", "/api/users/me/photo"],
  ] as const)("%s %s requires authentication", async (method, path) => {
    const { app } = setup(false);
    const response = await request(app)[method](path).send({ phone: "1100000000" });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("UNAUTHORIZED");
  });
});
