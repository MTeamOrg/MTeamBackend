import type { RequestHandler } from "express";

import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import type { PaymentPreviewService } from "../service/payment-preview-service.js";
import { createPaymentSchema } from "../validator/payment-validator.js";

export class PaymentPreviewController {
  constructor(private readonly previewService: PaymentPreviewService) {}

  previewPayment: RequestHandler = async (request, response) => {
    const validation = createPaymentSchema.safeParse(request.body);
    if (!validation.success) {
      throw new ApplicationError(400, ERROR_CODE.VALIDATION_ERROR,
        "Los datos del pago no son válidos", validation.error.flatten());
    }

    const preview = await this.previewService.previewPayment(validation.data);
    response.status(200).json({
      ...preview,
      estimatedAccreditedAt: preview.estimatedAccreditedAt.toISOString(),
      estimatedExpiresAt: preview.estimatedExpiresAt.toISOString(),
    });
  };
}
