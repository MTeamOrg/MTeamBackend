import { Router, type RequestHandler } from "express";

import type { AuthController } from "../controller/auth-controller.js";

export function createAuthRouter(authController: AuthController): Router {
  const authRouter = Router();
  authRouter.post("/auth/register", authController.registerMember);
  authRouter.post("/auth/login", authController.login);
  return authRouter;
}

export function createProtectedAuthRouter(
  authController: AuthController,
  authenticate: RequestHandler,
): Router {
  const authRouter = Router();
  authRouter.patch(
    "/auth/password",
    authenticate,
    authController.changePassword,
  );
  return authRouter;
}
