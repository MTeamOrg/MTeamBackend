import { Router, type RequestHandler } from "express";

import type { MemberMembershipController } from "../controller/member-membership-controller.js";
import { authorize } from "../middleware/authorization-middleware.js";

export function createMemberMembershipRouter(
  controller: MemberMembershipController,
  authenticate: RequestHandler,
  requireCompletedPasswordChange: RequestHandler,
): Router {
  const router = Router();
  router.get(
    "/members/me/membership",
    authenticate,
    requireCompletedPasswordChange,
    authorize("MEMBER"),
    controller.getOwnMembership,
  );
  return router;
}
