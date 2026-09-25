import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import type { Payment } from "../generated/prisma/client.js";
import {
  MemberNotFoundError,
  PaymentAlreadyVoidedError,
  PaymentNotFoundError,
  UserIsNotMemberError,
  type PaymentRepositoryPort,
} from "../repository/payment-repository.js";
import type { CreatePaymentInput } from "../validator/payment-validator.js";

export class PaymentService {
  constructor(private readonly paymentRepository: PaymentRepositoryPort) {}

  async createPayment(input: CreatePaymentInput, administratorId: string): Promise<Payment> {
    try {
      return await this.paymentRepository.createAccreditedPayment(input, administratorId);
    } catch (error: unknown) {
      if (error instanceof MemberNotFoundError) {
        throw new ApplicationError(404, ERROR_CODE.NOT_FOUND, "El usuario no existe");
      }
      if (error instanceof UserIsNotMemberError) {
        throw new ApplicationError(
          400,
          ERROR_CODE.VALIDATION_ERROR,
          "El usuario indicado no es socio",
        );
      }
      throw error;
    }
  }

  async voidPayment(paymentId: string, reason: string, administratorId: string): Promise<Payment> {
    try {
      return await this.paymentRepository.voidAccreditedPayment(paymentId, reason, administratorId);
    } catch (error: unknown) {
      if (error instanceof PaymentNotFoundError) {
        throw new ApplicationError(404, ERROR_CODE.NOT_FOUND, "El pago no existe");
      }
      if (error instanceof PaymentAlreadyVoidedError) {
        throw new ApplicationError(409, ERROR_CODE.CONFLICT, "El pago ya fue anulado");
      }
      throw error;
    }
  }
}
