import type { Payment, Prisma, PrismaClient, User } from "../generated/prisma/client.js";
import { calculatePaymentExpiresAt } from "../model/payment-expiration.js";
import type {
  CreatePaymentInput,
  PaymentHistoryQuery,
  PaymentListQuery,
  PaymentSummaryQuery,
} from "../validator/payment-validator.js";

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

export type PaymentReportMember = Pick<User,
  "id" | "firstName" | "lastName" | "documentNumber" | "email"
>;

export interface PaymentReportItem extends PaymentHistoryItem {
  member: PaymentReportMember;
}

export interface PaymentReport {
  items: PaymentReportItem[];
  page: number;
  limit: number;
  total: number;
}

export interface PaymentSummary {
  from: Date;
  to: Date;
  paymentCount: number;
  totalAmount: string;
}

const paymentHistorySelect = {
  id: true,
  accreditedAt: true,
  amount: true,
  method: true,
  receiptNumber: true,
  status: true,
  expiresAt: true,
  voidedAt: true,
  voidReason: true,
} as const;

export interface PaymentRepositoryPort {
  createAccreditedPayment(
    input: CreatePaymentInput,
    administratorId: string,
  ): Promise<Payment>;
  voidAccreditedPayment(paymentId: string, reason: string, administratorId: string): Promise<Payment>;
  isMember(memberId: string): Promise<boolean>;
  listMemberPayments(memberId: string, query: PaymentHistoryQuery): Promise<PaymentHistory>;
  listPayments(query: PaymentListQuery): Promise<PaymentReport>;
  getPaymentsSummary(query: PaymentSummaryQuery): Promise<PaymentSummary>;
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
        select: paymentHistorySelect,
      }),
    ]);
    return { items, page: query.page, limit: query.limit, total };
  }

  async listPayments(query: PaymentListQuery): Promise<PaymentReport> {
    const where: Prisma.PaymentWhereInput = {};
    if (query.memberId) where.memberId = query.memberId;
    if (query.documentNumber) {
      where.member = { is: { documentNumber: { contains: query.documentNumber } } };
    }
    if (query.method) where.method = query.method;
    if (query.status) where.status = query.status;
    if (query.from || query.to) {
      where.accreditedAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lt: new Date(query.to) } : {}),
      };
    }

    const [total, items] = await this.database.$transaction([
      this.database.payment.count({ where }),
      this.database.payment.findMany({
        where,
        orderBy: [{ accreditedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          ...paymentHistorySelect,
          member: { select: {
            id: true, firstName: true, lastName: true, documentNumber: true, email: true,
          } },
        },
      }),
    ]);
    return { items, page: query.page, limit: query.limit, total };
  }

  async getPaymentsSummary(query: PaymentSummaryQuery): Promise<PaymentSummary> {
    const from = new Date(query.from);
    const to = new Date(query.to);
    const aggregate = await this.database.payment.aggregate({
      where: { status: "ACCREDITED", accreditedAt: { gte: from, lt: to } },
      _count: { id: true },
      _sum: { amount: true },
    });
    return {
      from,
      to,
      paymentCount: aggregate._count.id,
      totalAmount: aggregate._sum.amount?.toString() ?? "0",
    };
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
      const expiresAt = calculatePaymentExpiresAt(accreditedAt);

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
