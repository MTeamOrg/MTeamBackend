import { Router, type RequestHandler } from "express";

import type { NewsPostController } from "../controller/news-post-controller.js";
import { authorize } from "../middleware/authorization-middleware.js";

export function createNewsPostRouter(
  controller: NewsPostController,
  authenticate: RequestHandler,
  requireCompletedPasswordChange: RequestHandler,
): Router {
  const router = Router();
  const userAccess = [authenticate, requireCompletedPasswordChange, authorize("MEMBER", "TRAINER", "ADMIN")];
  const adminAccess = [authenticate, requireCompletedPasswordChange, authorize("ADMIN")];
  router.get("/news-posts", ...userAccess, controller.list);
  router.get("/news-posts/:newsPostId", ...userAccess, controller.get);
  router.post("/news-posts", ...adminAccess, controller.create);
  router.patch("/news-posts/:newsPostId", ...adminAccess, controller.update);
  router.patch("/news-posts/:newsPostId/status", ...adminAccess, controller.updateStatus);
  return router;
}
