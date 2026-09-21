import jwt from "jsonwebtoken";
import request from "supertest";

import { createAccessControlApp, testSecret, userId } from "../support/access-control-app.js";

const unauthorized = {
  code: "UNAUTHORIZED", message: "Se requiere una autenticación válida", details: null,
};

describe("authentication middleware", () => {
  test.each([undefined, "Basic abc", "Bearer", "Bearer a b", "Bearer  abc", "Bearer abc,def", "Bearer invalid"])(
    "rejects missing or malformed credentials: %s", async (header) => {
      const { app, repository, controller } = createAccessControlApp();
      const call = request(app).post("/private");
      if (header !== undefined) call.set("Authorization", header);
      const response = await call;
      expect(response.status).toBe(401);
      expect(response.body).toEqual(unauthorized);
      expect(repository.findAccessControlUserById).not.toHaveBeenCalled();
      expect(controller).not.toHaveBeenCalled();
    },
  );

  test.each([
    ["expired", () => jwt.sign({ sub: userId, role: "MEMBER" }, testSecret, { expiresIn: -1 })],
    ["wrong signature", () => jwt.sign({ sub: userId, role: "MEMBER" }, "other-test-secret", { expiresIn: 3600 })],
    ["wrong algorithm", () => jwt.sign({ sub: userId, role: "MEMBER" }, testSecret, { algorithm: "HS384", expiresIn: 3600 })],
    ["unsigned", () => jwt.sign({ sub: userId, role: "MEMBER" }, null, { algorithm: "none", expiresIn: 3600 })],
    ["missing expiry", () => jwt.sign({ sub: userId, role: "MEMBER" }, testSecret)],
    ["missing subject", () => jwt.sign({ role: "MEMBER" }, testSecret, { expiresIn: 3600 })],
    ["invalid subject", () => jwt.sign({ sub: "not-a-uuid", role: "MEMBER" }, testSecret, { expiresIn: 3600 })],
    ["invalid role", () => jwt.sign({ sub: userId, role: "OWNER" }, testSecret, { expiresIn: 3600 })],
    ["not yet valid", () => jwt.sign({ sub: userId, role: "MEMBER" }, testSecret, { notBefore: 3600, expiresIn: 7200 })],
  ] as const)("rejects %s tokens before reading the database", async (_name, makeToken) => {
    const { app, repository, controller } = createAccessControlApp();
    const response = await request(app).post("/private").set("Authorization", `Bearer ${makeToken()}`);
    expect(response.status).toBe(401);
    expect(response.body).toEqual(unauthorized);
    expect(repository.findAccessControlUserById).not.toHaveBeenCalled();
    expect(controller).not.toHaveBeenCalled();
  });

  test("accepts a valid token and attaches only the current access-control data", async () => {
    const { app, repository, tokens, currentUser } = createAccessControlApp();
    repository.findAccessControlUserById.mockResolvedValue({
      ...currentUser, passwordHash: "must-not-leak", email: "private@example.com", documentNumber: "12345678",
    } as typeof currentUser);
    const response = await request(app).post("/private")
      .set("Authorization", `Bearer ${tokens.sign({ id: userId, role: "ADMIN" })}`)
      .send({ id: "client-supplied-id", role: "ADMIN" });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: userId,
      role: "MEMBER",
      isPasswordChangeRequired: false,
    });
    expect(repository.findAccessControlUserById).toHaveBeenCalledWith(userId);
  });

  test("rejects a deleted user", async () => {
    const { app, repository, tokens, controller } = createAccessControlApp();
    repository.findAccessControlUserById.mockResolvedValue(null);
    const response = await request(app).post("/private")
      .set("Authorization", `Bearer ${tokens.sign({ id: userId, role: "MEMBER" })}`);
    expect(response.status).toBe(401);
    expect(response.body).toEqual(unauthorized);
    expect(controller).not.toHaveBeenCalled();
  });

  test("rechecks account status for the same JWT on every request without changing the user", async () => {
    const { app, repository, tokens, currentUser, controller } = createAccessControlApp();
    const token = tokens.sign(currentUser);
    expect((await request(app).post("/private").set("Authorization", `Bearer ${token}`)).status).toBe(200);
    currentUser.status = "INACTIVE";
    const snapshot = { ...currentUser };
    const response = await request(app).post("/private").set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(403);
    expect(response.body).toEqual({ code: "ACCOUNT_INACTIVE", message: "La cuenta se encuentra inactiva", details: null });
    expect(repository.findAccessControlUserById).toHaveBeenCalledTimes(2);
    expect(controller).toHaveBeenCalledTimes(1);
    expect(currentUser).toEqual(snapshot);
  });

  test("does not accept a token from the body", async () => {
    const { app, tokens } = createAccessControlApp();
    const response = await request(app).post("/private").send({ accessToken: tokens.sign({ id: userId, role: "ADMIN" }) });
    expect(response.status).toBe(401);
    expect(response.body).toEqual(unauthorized);
  });

  test("database failures reach the existing error handler without granting access", async () => {
    const { app, repository, tokens, controller } = createAccessControlApp();
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      repository.findAccessControlUserById.mockRejectedValue(new Error("test database failure"));
      const response = await request(app).post("/private").set("Authorization", `Bearer ${tokens.sign({ id: userId, role: "MEMBER" })}`);
      expect(response.status).toBe(500);
      expect(response.body.code).toBe("INTERNAL_ERROR");
      expect(controller).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });
});
