import type { PrismaClient, UserStatus } from "../generated/prisma/client.js";
import { Prisma } from "../generated/prisma/client.js";
import { calculateMembershipStatus, EXPIRING_SOON_DAYS, type MembershipStatus } from "../model/membership-status.js";
import type { MemberListQueryInput } from "../validator/member-validator.js";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export interface MemberListItem {
  id: string;
  firstName: string;
  lastName: string;
  documentNumber: string;
  email: string;
  status: UserStatus;
  membershipStatus: MembershipStatus;
  lastPaymentAt: Date | null;
  expiresAt: Date | null;
}

export interface MemberListResult {
  items: MemberListItem[];
  page: number;
  limit: number;
  total: number;
}

export interface MemberRepositoryPort {
  listMembers(query: MemberListQueryInput, now: Date): Promise<MemberListResult>;
}

export class MemberRepository implements MemberRepositoryPort {
  constructor(private readonly database: PrismaClient) {}

  async listMembers(query: MemberListQueryInput, now: Date): Promise<MemberListResult> {
    const validPayment: Prisma.PaymentWhereInput = {
      status: "ACCREDITED",
      accreditedAt: { lte: now },
    };
    const soonBoundary = new Date(now.getTime() + EXPIRING_SOON_DAYS * MILLISECONDS_PER_DAY);
    const paymentExpiringAfter = (date: Date): Prisma.PaymentWhereInput => ({
      ...validPayment,
      expiresAt: { gt: date },
    });
    const where: Prisma.UserWhereInput = { role: "MEMBER" };
    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: "insensitive" } },
        { lastName: { contains: query.search, mode: "insensitive" } },
        { documentNumber: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } },
      ];
    }
    // Every payment expires exactly 30 days after accreditation. Therefore the latest
    // valid accreditation also has the latest expiration. Relation filters can select
    // the membership state before pagination without loading every member's payments.
    if (query.membershipStatus === "CURRENT") {
      where.memberPayments = { some: paymentExpiringAfter(soonBoundary) };
    } else if (query.membershipStatus === "EXPIRING_SOON") {
      where.AND = [
        { memberPayments: { some: paymentExpiringAfter(now) } },
        { memberPayments: { none: paymentExpiringAfter(soonBoundary) } },
      ];
    } else if (query.membershipStatus === "EXPIRED") {
      where.memberPayments = { none: paymentExpiringAfter(now) };
    }

    const [total, users] = await this.database.$transaction([
      this.database.user.count({ where }),
      this.database.user.findMany({
        where,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          documentNumber: true,
          email: true,
          status: true,
          memberPayments: {
            where: validPayment,
            orderBy: [{ accreditedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
            take: 1,
            select: { accreditedAt: true, expiresAt: true },
          },
        },
      }),
    ]);

    return {
      items: users.map(({ memberPayments, ...user }) => {
        const payment = memberPayments[0];
        const expiresAt = payment?.expiresAt ?? null;
        return {
          ...user,
          membershipStatus: calculateMembershipStatus(expiresAt, now),
          lastPaymentAt: payment?.accreditedAt ?? null,
          expiresAt,
        };
      }),
      page: query.page,
      limit: query.limit,
      total,
    };
  }
}
