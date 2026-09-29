import { Prisma, type Payment, type PrismaClient, type User } from "../generated/prisma/client.js";
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
  days: PaymentSummaryDay[];
}

export interface PaymentSummaryDay {
  date: string;
  amount: string;
}

const GYM_TIME_ZONE = "America/Argentina/Buenos_Aires";
const gymDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: GYM_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function gymDate(instant: Date): string {
  return gymDateFormatter.format(instant);
}

function addDays(date: string, days: number): string {
  const instant = new Date(`${date}T00:00:00.000Z`);
  instant.setUTCDate(instant.getUTCDate() + days);
  return instant.toISOString().slice(0, 10);
}

function datesCoveredByRange(from: Date, to: Date): string[] {
  const firstDate = gymDate(from);
  const lastDate = gymDate(new Date(to.getTime() - 1));
  const dates: string[] = [];
  for (let date = firstDate; date <= lastDate; date = addDays(date, 1)) dates.push(date);
  return dates;
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
    const where = { status: "ACCREDITED" as const, accreditedAt: { gte: from, lt: to } };
    const [aggregate, payments] = await Promise.all([
      this.database.payment.aggregate({
        where,
        _count: { id: true },
        _sum: { amount: true },
      }),
      this.database.payment.findMany({
        where,
        select: { amount: true, accreditedAt: true, status: true },
      }),
    ]);
    const dailyTotals = new Map<string, Prisma.Decimal>();
    for (const payment of payments) {
      if (payment.status !== "ACCREDITED") continue;
      const date = gymDate(payment.accreditedAt);
      dailyTotals.set(date, (dailyTotals.get(date) ?? new Prisma.Decimal("0")).plus(payment.amount));
    }
    return {
      from,
      to,
      paymentCount: aggregate._count.id,
      totalAmount: aggregate._sum.amount?.toString() ?? "0",
      days: datesCoveredByRange(from, to).map((date) => ({
        date,
        amount: dailyTotals.get(date)?.toString() ?? "0",
      })),
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
