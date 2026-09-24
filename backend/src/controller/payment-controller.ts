import type { RequestHandler } from "express";

import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import type { PaymentService } from "../service/payment-service.js";
import { createPaymentSchema } from "../validator/payment-validator.js";

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
}
