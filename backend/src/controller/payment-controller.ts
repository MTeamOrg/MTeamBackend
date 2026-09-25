import type { RequestHandler } from "express";

import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import type { PaymentService } from "../service/payment-service.js";
import { createPaymentSchema, voidPaymentParamsSchema, voidPaymentSchema } from "../validator/payment-validator.js";

export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  createPayment: RequestHandler = async (request, response) => {
    const validation = createPaymentSchema.safeParse(request.body);
    if (!validation.success) {
      throw new ApplicationError(
        400,
        ERROR_CODE.VALIDATION_ERROR,
        "Los datos del pago no son válidos",
        validation.error.flatten(),
      );
    }

    const payment = await this.paymentService.createPayment(
      validation.data,
      request.authenticatedUser!.id,
    );
    response.status(201).json({ ...payment, amount: payment.amount.toString() });
  };

  voidPayment: RequestHandler = async (request, response) => {
    const paramsValidation = voidPaymentParamsSchema.safeParse(request.params);
    const bodyValidation = voidPaymentSchema.safeParse(request.body);
    if (!paramsValidation.success || !bodyValidation.success) {
      throw new ApplicationError(
        400,
        ERROR_CODE.VALIDATION_ERROR,
        "Los datos para anular el pago no son válidos",
        {
          params: paramsValidation.success ? null : paramsValidation.error.flatten(),
          body: bodyValidation.success ? null : bodyValidation.error.flatten(),
        },
      );
    }

    const payment = await this.paymentService.voidPayment(
      paramsValidation.data.paymentId,
      bodyValidation.data.reason,
      request.authenticatedUser!.id,
    );
    response.status(200).json({ ...payment, amount: payment.amount.toString() });
  };
}
