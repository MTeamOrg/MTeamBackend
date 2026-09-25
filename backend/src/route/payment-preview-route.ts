import { Router, type RequestHandler } from "express";

import type { PaymentPreviewController } from "../controller/payment-preview-controller.js";
import { authorize } from "../middleware/authorization-middleware.js";

export function createPaymentPreviewRouter(
  controller: PaymentPreviewController,
  authenticate: RequestHandler,
  requireCompletedPasswordChange: RequestHandler,
): Router {
  const router = Router();
  router.post(
    "/payments/previews",
    authenticate,
    requireCompletedPasswordChange,
    authorize("ADMIN"),
    controller.previewPayment,
  );
  return router;
}
