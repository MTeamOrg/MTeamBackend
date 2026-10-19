import { Router, type RequestHandler } from "express";

import type { BranchController } from "../controller/branch-controller.js";
import { authorize } from "../middleware/authorization-middleware.js";

export function createBranchRouter(
  controller: BranchController,
  authenticate: RequestHandler,
  requireCompletedPasswordChange: RequestHandler,
): Router {
  const router = Router();
  router.get("/branches", controller.listPublicBranches);
  router.get("/branches/:branchId", controller.getPublicBranch);
  router.get(
    "/admin/branches",
    authenticate,
    requireCompletedPasswordChange,
    authorize("ADMIN"),
    controller.listAdminBranches,
  );
  router.get(
    "/admin/branches/:branchId",
    authenticate,
    requireCompletedPasswordChange,
    authorize("ADMIN"),
    controller.getAdminBranch,
  );
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
  router.patch(
    "/branches/:branchId/status",
    authenticate,
    requireCompletedPasswordChange,
    authorize("ADMIN"),
    controller.updateBranchStatus,
  );
  return router;
}
