import { Router, type RequestHandler } from "express";

import type { NotificationController } from "../controller/notification-controller.js";
import { authorize } from "../middleware/authorization-middleware.js";

export function createNotificationRouter(
  controller: NotificationController,
  authenticate: RequestHandler,
  requireCompletedPasswordChange: RequestHandler,
): Router {
  const router = Router();
  const access = [authenticate, requireCompletedPasswordChange, authorize("MEMBER", "TRAINER", "ADMIN")];
  router.get("/notifications", ...access, controller.list);
  router.patch("/notifications/read-status", ...access, controller.markAllRead);
  router.get("/notifications/:notificationId", ...access, controller.get);
  router.patch("/notifications/:notificationId/read-status", ...access, controller.markRead);
  return router;
}
