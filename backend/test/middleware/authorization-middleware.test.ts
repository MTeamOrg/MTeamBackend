import express from "express";
import request from "supertest";

import { authorize } from "../../src/middleware/authorization-middleware.js";
import { errorMiddleware } from "../../src/middleware/error-middleware.js";
import { createAccessControlApp } from "../support/access-control-app.js";

describe("role authorization middleware", () => {
  test.each(["ADMIN", "TRAINER", "MEMBER"] as const)("allows the required %s role", async (role) => {
    const { app, tokens, currentUser } = createAccessControlApp([role]);
    currentUser.role = role;
    const response = await request(app).post("/private").set("Authorization", `Bearer ${tokens.sign(currentUser)}`);
    expect(response.status).toBe(200);
    expect(response.body.role).toBe(role);
  });

  test.each(["ADMIN", "TRAINER"] as const)("accepts %s when multiple roles are allowed", async (role) => {
    const { app, tokens, currentUser } = createAccessControlApp(["ADMIN", "TRAINER"]);
    currentUser.role = role;
    expect((await request(app).post("/private").set("Authorization", `Bearer ${tokens.sign(currentUser)}`)).status).toBe(200);
  });

  test("uses the updated database role rather than the JWT role", async () => {
    const { app, tokens, currentUser, controller } = createAccessControlApp(["ADMIN", "TRAINER"]);
    currentUser.role = "ADMIN";
    const token = tokens.sign(currentUser);
    expect((await request(app).post("/private").set("Authorization", `Bearer ${token}`)).status).toBe(200);
    currentUser.role = "MEMBER";
    const denied = await request(app).post("/private").set("Authorization", `Bearer ${token}`);
    expect(denied.status).toBe(403);
    expect(denied.body).toEqual({ code: "FORBIDDEN", message: "No tiene permisos para realizar esta operación", details: null });
    expect(controller).toHaveBeenCalledTimes(1);
    currentUser.role = "TRAINER";
    expect((await request(app).post("/private").set("Authorization", `Bearer ${token}`)).status).toBe(200);
  });

  test("fails closed if used without authentication", async () => {
    const app = express();
    const controller = jest.fn((_req, res) => res.sendStatus(204));
    app.get("/private", authorize("ADMIN"), controller);
    app.use(errorMiddleware);
    const response = await request(app).get("/private");
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ code: "UNAUTHORIZED", message: "Se requiere una autenticación válida", details: null });
    expect(controller).not.toHaveBeenCalled();
  });

  test("denies access when no roles have been allowed", async () => {
    const { app, tokens, currentUser } = createAccessControlApp([]);
    const response = await request(app).post("/private").set("Authorization", `Bearer ${tokens.sign(currentUser)}`);
    expect(response.status).toBe(403);
  });
});
