import type { RequestHandler } from "express";

import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import type { PaymentService } from "../service/payment-service.js";
import type { PaymentHistory } from "../repository/payment-repository.js";
import {
  createPaymentSchema,
  memberPaymentsParamsSchema,
  paymentHistoryQuerySchema,
  voidPaymentParamsSchema,
  voidPaymentSchema,
} from "../validator/payment-validator.js";

function serializePaymentHistory(history: PaymentHistory) {
  return {
    ...history,
    items: history.items.map((payment) => ({
      ...payment,
      amount: payment.amount.toString(),
      accreditedAt: payment.accreditedAt.toISOString(),
      expiresAt: payment.expiresAt.toISOString(),
      voidedAt: payment.voidedAt?.toISOString() ?? null,
    })),
  };
}

export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  listOwnPayments: RequestHandler = async (request, response) => {
    const validation = paymentHistoryQuerySchema.safeParse(request.query);
    if (!validation.success) {
      throw new ApplicationError(400, ERROR_CODE.VALIDATION_ERROR,
        "Los filtros del historial de pagos no son válidos", validation.error.flatten());
    }
    const history = await this.paymentService.listMemberPayments(
      request.authenticatedUser!.id, validation.data,
    );
    response.status(200).json(serializePaymentHistory(history));
  };

  listMemberPayments: RequestHandler = async (request, response) => {
    const paramsValidation = memberPaymentsParamsSchema.safeParse(request.params);
    const queryValidation = paymentHistoryQuerySchema.safeParse(request.query);
    if (!paramsValidation.success || !queryValidation.success) {
      throw new ApplicationError(400, ERROR_CODE.VALIDATION_ERROR,
        "Los datos del historial de pagos no son válidos", {
          params: paramsValidation.success ? null : paramsValidation.error.flatten(),
          query: queryValidation.success ? null : queryValidation.error.flatten(),
        });
    }
    const history = await this.paymentService.listMemberPayments(
      paramsValidation.data.memberId, queryValidation.data,
    );
    response.status(200).json(serializePaymentHistory(history));
  };

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
