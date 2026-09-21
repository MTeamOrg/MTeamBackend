import { Router, type RequestHandler } from "express";

import type { AdminUserController } from "../controller/admin-user-controller.js";
import { authorize } from "../middleware/authorization-middleware.js";

export function createAdminUserRouter(
  controller: AdminUserController,
  authenticate: RequestHandler,
  requireCompletedPasswordChange: RequestHandler,
): Router {
  const router = Router();
  router.post(
    "/users/:userId/password-resets",
    authenticate,
    requireCompletedPasswordChange,
    authorize("ADMIN"),
    controller.resetTemporaryPassword,
  );
  return router;
}
