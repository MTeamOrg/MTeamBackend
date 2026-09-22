import { Router, type RequestHandler } from "express";

import type { AdminUserController } from "../controller/admin-user-controller.js";
import { authorize } from "../middleware/authorization-middleware.js";

export function createAdminUserRouter(
  controller: AdminUserController,
  authenticate: RequestHandler,
  requireCompletedPasswordChange: RequestHandler,
): Router {
  const router = Router();
  router.get(
    "/users",
    authenticate,
    requireCompletedPasswordChange,
    authorize("ADMIN"),
    controller.listUsers,
  );
  router.post(
    "/users",
    authenticate,
    requireCompletedPasswordChange,
    authorize("ADMIN"),
    controller.createUser,
  );
  router.get(
    "/users/:userId",
    authenticate,
    requireCompletedPasswordChange,
    authorize("ADMIN"),
    controller.getUser,
  );
  router.patch(
    "/users/:userId",
    authenticate,
    requireCompletedPasswordChange,
    authorize("ADMIN"),
    controller.updateUser,
  );
  router.patch(
    "/users/:userId/status",
    authenticate,
    requireCompletedPasswordChange,
    authorize("ADMIN"),
    controller.updateUserStatus,
  );
  router.get(
    "/users/:userId/audit-logs",
    authenticate,
    requireCompletedPasswordChange,
    authorize("ADMIN"),
    controller.listUserAuditLogs,
  );
  router.post(
    "/users/:userId/password-resets",
    authenticate,
    requireCompletedPasswordChange,
    authorize("ADMIN"),
    controller.resetTemporaryPassword,
  );
  return router;
}
