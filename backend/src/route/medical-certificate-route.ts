import { Router, type RequestHandler } from "express";

import type { MedicalCertificateController } from "../controller/medical-certificate-controller.js";
import { authorize } from "../middleware/authorization-middleware.js";
import { uploadMedicalCertificate } from "../middleware/medical-certificate-upload-middleware.js";

export function createMedicalCertificateRouter(
  controller: MedicalCertificateController,
  authenticate: RequestHandler,
  requireCompletedPasswordChange: RequestHandler,
): Router {
  const router = Router();
  const memberAccess = [authenticate, requireCompletedPasswordChange, authorize("MEMBER")];
  const adminAccess = [authenticate, requireCompletedPasswordChange, authorize("ADMIN")];
  const memberOrAdminAccess = [authenticate, requireCompletedPasswordChange, authorize("MEMBER", "ADMIN")];

  router.get("/members/me/medical-certificates", ...memberAccess, controller.listOwn);
  router.post(
    "/members/me/medical-certificates",
    ...memberAccess,
    uploadMedicalCertificate,
    controller.upload,
  );
  router.get("/medical-certificates", ...adminAccess, controller.listAdmin);
  router.get("/medical-certificates/:certificateId", ...memberOrAdminAccess, controller.get);
  router.get("/medical-certificates/:certificateId/file", ...memberOrAdminAccess, controller.getFile);
  router.patch(
    "/medical-certificates/:certificateId/review",
    ...adminAccess,
    controller.review,
  );
  return router;
}
