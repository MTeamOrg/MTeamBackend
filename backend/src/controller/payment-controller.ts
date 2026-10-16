import type { RequestHandler } from "express";

import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import type { PaymentService } from "../service/payment-service.js";
import type { PaymentHistory, PaymentHistoryItem } from "../repository/payment-repository.js";
import type { Payment } from "../generated/prisma/client.js";
import {
  createPaymentSchema,
  paymentIdempotencyKeySchema,
  memberPaymentsParamsSchema,
  paymentHistoryQuerySchema,
  paymentListQuerySchema,
  paymentSummaryQuerySchema,
  voidPaymentParamsSchema,
  voidPaymentSchema,
} from "../validator/payment-validator.js";

function serializePaymentHistoryItem(payment: PaymentHistoryItem) {
  return {
    ...payment,
    amount: payment.amount.toString(),
    accreditedAt: payment.accreditedAt.toISOString(),
    expiresAt: payment.expiresAt.toISOString(),
    voidedAt: payment.voidedAt?.toISOString() ?? null,
  };
}

function serializePaymentHistory(history: PaymentHistory) {
  return {
    ...history,
    items: history.items.map(serializePaymentHistoryItem),
  };
}

function serializePayment(payment: Payment) {
  const { idempotencyKey, ...publicPayment } = payment;
  void idempotencyKey;
  return { ...publicPayment, amount: payment.amount.toString() };
}

export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  listPayments: RequestHandler = async (request, response) => {
    const validation = paymentListQuerySchema.safeParse(request.query);
    if (!validation.success) {
      throw new ApplicationError(400, ERROR_CODE.VALIDATION_ERROR,
        "Los filtros de pagos no son válidos", validation.error.flatten());
    }
    const report = await this.paymentService.listPayments(validation.data);
    response.status(200).json({
      ...report,
      items: report.items.map(({ member, ...payment }) => ({
        ...serializePaymentHistoryItem(payment), member,
      })),
    });
  };

  getPaymentsSummary: RequestHandler = async (request, response) => {
    const validation = paymentSummaryQuerySchema.safeParse(request.query);
    if (!validation.success) {
      throw new ApplicationError(400, ERROR_CODE.VALIDATION_ERROR,
        "El rango de fechas no es válido", validation.error.flatten());
    }
    const summary = await this.paymentService.getPaymentsSummary(validation.data);
    response.status(200).json({
      ...summary,
      from: summary.from.toISOString(),
      to: summary.to.toISOString(),
    });
  };

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
    const idempotencyKeyValidation = paymentIdempotencyKeySchema.safeParse(
      request.get("Idempotency-Key"),
    );
    if (!validation.success || !idempotencyKeyValidation.success) {
      throw new ApplicationError(
        400,
        ERROR_CODE.VALIDATION_ERROR,
        "Los datos del pago o su clave de solicitud no son válidos",
        {
          body: validation.success ? null : validation.error.flatten(),
          idempotencyKey: idempotencyKeyValidation.success
            ? null
            : idempotencyKeyValidation.error.flatten(),
        },
      );
    }

    const payment = await this.paymentService.createPayment(
      validation.data,
      request.authenticatedUser!.id,
      idempotencyKeyValidation.data,
    );
    response.status(201).json(serializePayment(payment));
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
    response.status(200).json(serializePayment(payment));
  };
}
