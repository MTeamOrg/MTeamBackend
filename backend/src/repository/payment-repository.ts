import type { Payment, PrismaClient } from "../generated/prisma/client.js";
import type { CreatePaymentInput } from "../validator/payment-validator.js";

const MEMBERSHIP_VALIDITY_DAYS = 30;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export class MemberNotFoundError extends Error {}
export class UserIsNotMemberError extends Error {}
export class PaymentNotFoundError extends Error {}
export class PaymentAlreadyVoidedError extends Error {}

export interface PaymentRepositoryPort {
  createAccreditedPayment(
    input: CreatePaymentInput,
    administratorId: string,
  ): Promise<Payment>;
  voidAccreditedPayment(paymentId: string, reason: string, administratorId: string): Promise<Payment>;
}

export class PaymentRepository implements PaymentRepositoryPort {
  constructor(private readonly database: PrismaClient) {}

  createAccreditedPayment(
    input: CreatePaymentInput,
    administratorId: string,
  ): Promise<Payment> {
    return this.database.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({
        where: { id: input.memberId },
        select: { role: true },
      });
      if (!user) throw new MemberNotFoundError();
      if (user.role !== "MEMBER") throw new UserIsNotMemberError();

      const accreditedAt = new Date();
      const expiresAt = new Date(
        accreditedAt.getTime() + MEMBERSHIP_VALIDITY_DAYS * MILLISECONDS_PER_DAY,
      );

      return transaction.payment.create({
        data: {
          memberId: input.memberId,
          amount: input.amount.toString(),
          method: input.method,
          receiptNumber: input.receiptNumber ?? null,
          status: "ACCREDITED",
          createdById: administratorId,
          confirmedById: administratorId,
          accreditedAt,
          expiresAt,
        },
      });
    });
  }

  voidAccreditedPayment(paymentId: string, reason: string, administratorId: string): Promise<Payment> {
    return this.database.$transaction(async (transaction) => {
      const result = await transaction.payment.updateMany({
        where: { id: paymentId, status: "ACCREDITED" },
        data: {
          status: "VOIDED",
          voidReason: reason,
          voidedById: administratorId,
          voidedAt: new Date(),
        },
      });
      if (result.count === 0) {
        const payment = await transaction.payment.findUnique({
          where: { id: paymentId },
          select: { id: true },
        });
        if (!payment) throw new PaymentNotFoundError();
        throw new PaymentAlreadyVoidedError();
      }
      return transaction.payment.findUniqueOrThrow({ where: { id: paymentId } });
    });
  }
}
