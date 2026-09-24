import { Router, type RequestHandler } from "express";

import type { MembershipPriceController } from "../controller/membership-price-controller.js";
import { authorize } from "../middleware/authorization-middleware.js";

export function createMembershipPriceRouter(
  controller: MembershipPriceController,
  authenticate: RequestHandler,
  requireCompletedPasswordChange: RequestHandler,
): Router {
  const router = Router();
  router.get(
    "/membership-prices/current",
    authenticate,
    requireCompletedPasswordChange,
    controller.getCurrentPrice,
  );
  router.post(
    "/membership-prices",
    authenticate,
    requireCompletedPasswordChange,
    authorize("ADMIN"),
    controller.createInitialPrice,
  );
  return router;
}
