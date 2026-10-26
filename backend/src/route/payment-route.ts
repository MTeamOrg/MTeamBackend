import { Router, type RequestHandler } from "express";

import type { PaymentController } from "../controller/payment-controller.js";
import { authorize } from "../middleware/authorization-middleware.js";

export function createPaymentRouter(
  controller: PaymentController,
  authenticate: RequestHandler,
  requireCompletedPasswordChange: RequestHandler,
): Router {
  const router = Router();
  router.get(
    "/payments/summary",
    authenticate,
    requireCompletedPasswordChange,
    authorize("ADMIN"),
    controller.getPaymentsSummary,
  );
  router.get(
    "/payments",
    authenticate,
    requireCompletedPasswordChange,
    authorize("ADMIN"),
    controller.listPayments,
  );
  router.get(
    "/members/me/payments",
    authenticate,
    requireCompletedPasswordChange,
    authorize("MEMBER"),
    controller.listOwnPayments,
  );
  router.get(
    "/members/:memberId/payments",
    authenticate,
    requireCompletedPasswordChange,
    authorize("ADMIN"),
    controller.listMemberPayments,
  );
  router.post(
    "/payments",
    authenticate,
    requireCompletedPasswordChange,
    authorize("ADMIN"),
    controller.createPayment,
  );
  router.post(
    "/payments/:paymentId/voids",
    authenticate,
    requireCompletedPasswordChange,
    authorize("ADMIN"),
    controller.voidPayment,
  );
  return router;
}
