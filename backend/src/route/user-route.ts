import { Router, type RequestHandler } from "express";

import type { UserController } from "../controller/user-controller.js";

export function createUserRouter(
  userController: UserController,
  authenticate: RequestHandler,
  requireCompletedPasswordChange: RequestHandler,
  uploadPhoto: RequestHandler,
): Router {
  const userRouter = Router();
  userRouter.get(
    "/auth/me",
    authenticate,
    requireCompletedPasswordChange,
    userController.getCurrentIdentity,
  );
  userRouter.get(
    "/users/me",
    authenticate,
    requireCompletedPasswordChange,
    userController.getOwnProfile,
  );
  userRouter.patch(
    "/users/me",
    authenticate,
    requireCompletedPasswordChange,
    userController.updateOwnProfile,
  );
  userRouter.put(
    "/users/me/photo",
    authenticate,
    requireCompletedPasswordChange,
    uploadPhoto,
    userController.updateOwnPhoto,
  );
  return userRouter;
}
