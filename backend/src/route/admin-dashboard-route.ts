import { Router, type RequestHandler } from "express";

import type { AdminDashboardController } from "../controller/admin-dashboard-controller.js";
import { authorize } from "../middleware/authorization-middleware.js";

export function createAdminDashboardRouter(
  controller: AdminDashboardController,
  authenticate: RequestHandler,
  requireCompletedPasswordChange: RequestHandler,
): Router {
  const router = Router();
  router.get(
    "/admin/dashboard/metrics",
    authenticate,
    requireCompletedPasswordChange,
    authorize("ADMIN"),
    controller.getMetrics,
  );
  return router;
}
