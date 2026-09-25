import { Router, type RequestHandler } from "express";

import type { MemberController } from "../controller/member-controller.js";
import { authorize } from "../middleware/authorization-middleware.js";

export function createMemberRouter(
  controller: MemberController,
  authenticate: RequestHandler,
  requireCompletedPasswordChange: RequestHandler,
): Router {
  const router = Router();
  router.get("/members", authenticate, requireCompletedPasswordChange,
    authorize("ADMIN"), controller.listMembers);
  return router;
}
