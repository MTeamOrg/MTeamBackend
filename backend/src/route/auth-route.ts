import { Router } from "express";

import type { AuthController } from "../controller/auth-controller.js";

export function createAuthRouter(authController: AuthController): Router {
  const authRouter = Router();
  authRouter.post("/auth/register", authController.registerMember);
  return authRouter;
}
