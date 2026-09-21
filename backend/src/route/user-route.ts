import { Router, type RequestHandler } from "express";

import type { UserController } from "../controller/user-controller.js";

export function createUserRouter(
  userController: UserController,
  authenticate: RequestHandler,
): Router {
  const userRouter = Router();
  userRouter.get("/auth/me", authenticate, userController.getCurrentIdentity);
  userRouter.get("/users/me", authenticate, userController.getOwnProfile);
  userRouter.patch("/users/me", authenticate, userController.updateOwnProfile);
  return userRouter;
}
