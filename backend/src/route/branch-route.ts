import { Router, type RequestHandler } from "express";

import type { BranchController } from "../controller/branch-controller.js";
import { authorize } from "../middleware/authorization-middleware.js";

export function createBranchRouter(
  controller: BranchController,
  authenticate: RequestHandler,
  requireCompletedPasswordChange: RequestHandler,
): Router {
  const router = Router();
  router.post(
    "/branches",
    authenticate,
    requireCompletedPasswordChange,
    authorize("ADMIN"),
    controller.createBranch,
  );
  router.patch(
    "/branches/:branchId",
    authenticate,
    requireCompletedPasswordChange,
    authorize("ADMIN"),
    controller.updateBranch,
  );
  return router;
}
