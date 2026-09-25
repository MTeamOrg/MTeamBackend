import type { Payment, PrismaClient } from "../generated/prisma/client.js";
import type { CreatePaymentInput, PaymentHistoryQuery } from "../validator/payment-validator.js";

const MEMBERSHIP_VALIDITY_DAYS = 30;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export class MemberNotFoundError extends Error {}
export class UserIsNotMemberError extends Error {}
export class PaymentNotFoundError extends Error {}
export class PaymentAlreadyVoidedError extends Error {}

export type PaymentHistoryItem = Pick<Payment,
  "id" | "amount" | "method" | "receiptNumber" | "status" |
  "accreditedAt" | "expiresAt" | "voidedAt" | "voidReason"
>;

export interface PaymentHistory {
  items: PaymentHistoryItem[];
  page: number;
  limit: number;
  total: number;
}

export interface PaymentRepositoryPort {
  createAccreditedPayment(
    input: CreatePaymentInput,
    administratorId: string,
  ): Promise<Payment>;
  voidAccreditedPayment(paymentId: string, reason: string, administratorId: string): Promise<Payment>;
  isMember(memberId: string): Promise<boolean>;
  listMemberPayments(memberId: string, query: PaymentHistoryQuery): Promise<PaymentHistory>;
}

export class PaymentRepository implements PaymentRepositoryPort {
  constructor(private readonly database: PrismaClient) {}

  async isMember(memberId: string): Promise<boolean> {
    const member = await this.database.user.findFirst({
      where: { id: memberId, role: "MEMBER" },
      select: { id: true },
    });
    return member !== null;
  }

  async listMemberPayments(memberId: string, query: PaymentHistoryQuery): Promise<PaymentHistory> {
    const where = { memberId };
    const [total, items] = await this.database.$transaction([
      this.database.payment.count({ where }),
      this.database.payment.findMany({
        where,
        orderBy: [{ accreditedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          accreditedAt: true,
          amount: true,
          method: true,
          receiptNumber: true,
          status: true,
          expiresAt: true,
          voidedAt: true,
          voidReason: true,
        },
      }),
    ]);
    return { items, page: query.page, limit: query.limit, total };
  }

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
