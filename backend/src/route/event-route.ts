import { Router, type RequestHandler } from "express";

import type { EventController } from "../controller/event-controller.js";
import { authorize } from "../middleware/authorization-middleware.js";

export function createEventRouter(
  controller: EventController,
  authenticate: RequestHandler,
  requireCompletedPasswordChange: RequestHandler,
): Router {
  const router = Router();
  const userAccess = [authenticate, requireCompletedPasswordChange, authorize("MEMBER", "TRAINER", "ADMIN")];
  const adminAccess = [authenticate, requireCompletedPasswordChange, authorize("ADMIN")];
  router.get("/events", ...userAccess, controller.list);
  router.get("/events/:eventId", ...userAccess, controller.get);
  router.post("/events", ...adminAccess, controller.create);
  router.patch("/events/:eventId", ...adminAccess, controller.update);
  router.patch("/events/:eventId/status", ...adminAccess, controller.updateStatus);
  return router;
}
