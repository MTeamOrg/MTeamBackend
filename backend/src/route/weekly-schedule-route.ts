import { Router, type RequestHandler } from "express";

import type { WeeklyScheduleController } from "../controller/weekly-schedule-controller.js";
import { authorize } from "../middleware/authorization-middleware.js";

export function createWeeklyScheduleRouter(
  controller: WeeklyScheduleController,
  authenticate: RequestHandler,
  requireCompletedPasswordChange: RequestHandler,
): Router {
  const router = Router();
  router.get("/weekly-schedules", controller.getByWeek);
  router.get("/weekly-schedules/:scheduleId", controller.getById);
  router.post(
    "/weekly-schedules/:scheduleId/copies",
    authenticate,
    requireCompletedPasswordChange,
    authorize("ADMIN"),
    controller.copy,
  );
  return router;
}
