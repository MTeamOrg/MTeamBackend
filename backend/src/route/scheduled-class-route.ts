import { Router, type RequestHandler } from "express";

import type { ScheduledClassController } from "../controller/scheduled-class-controller.js";
import { authorize } from "../middleware/authorization-middleware.js";

export function createScheduledClassRouter(
  controller: ScheduledClassController,
  authenticate: RequestHandler,
  requireCompletedPasswordChange: RequestHandler,
): Router {
  const router = Router();
  const adminOnly = [authenticate, requireCompletedPasswordChange, authorize("ADMIN")];
  router.post("/scheduled-classes", ...adminOnly, controller.createClass);
  router.patch("/scheduled-classes/:classId", ...adminOnly, controller.updateClass);
  router.delete("/scheduled-classes/:classId", ...adminOnly, controller.deleteClass);
  return router;
}
