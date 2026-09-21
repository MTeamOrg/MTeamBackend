import express, { type RequestHandler } from "express";
import request from "supertest";

import { errorMiddleware } from "../../src/middleware/error-middleware.js";
import { requirePasswordChangeCompleted } from "../../src/middleware/password-change-middleware.js";

const userId = "83cd902e-0475-4c92-943c-129b751dacee";

function setup(isAuthenticated: boolean, isPasswordChangeRequired: boolean) {
  const authenticate: RequestHandler = (req, _res, next) => {
    if (isAuthenticated) {
      req.authenticatedUser = {
        id: userId,
        role: "MEMBER",
        isPasswordChangeRequired,
      };
    }
    next();
  };
  const controller = jest.fn((_req, res) => res.status(204).send());
  const app = express();
  app.get(
    "/private",
    authenticate,
    requirePasswordChangeCompleted,
    controller,
  );
  app.use(errorMiddleware);
  return { app, controller };
}

describe("requirePasswordChangeCompleted", () => {
  test("allows users who already changed their temporary password", async () => {
    const { app, controller } = setup(true, false);

    const response = await request(app).get("/private");

    expect(response.status).toBe(204);
    expect(controller).toHaveBeenCalledTimes(1);
  });

  test("blocks users who must change their temporary password", async () => {
    const { app, controller } = setup(true, true);

    const response = await request(app).get("/private");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      code: "PASSWORD_CHANGE_REQUIRED",
      message: "Debe cambiar la contraseña temporal antes de continuar",
      details: null,
    });
    expect(controller).not.toHaveBeenCalled();
  });

  test("requires an authenticated user", async () => {
    const { app, controller } = setup(false, false);

    const response = await request(app).get("/private");

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("UNAUTHORIZED");
    expect(controller).not.toHaveBeenCalled();
  });
});
