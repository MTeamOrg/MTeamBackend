import type { PrismaClient } from "../generated/prisma/client.js";

export interface LastAccreditedPayment {
  id: string;
  accreditedAt: Date;
  expiresAt: Date;
}

export interface MemberMembershipRepositoryPort {
  findLatestAccreditedPayment(memberId: string, now: Date): Promise<LastAccreditedPayment | null>;
}

export class MemberMembershipRepository implements MemberMembershipRepositoryPort {
  constructor(private readonly database: PrismaClient) {}

  findLatestAccreditedPayment(memberId: string, now: Date): Promise<LastAccreditedPayment | null> {
    return this.database.payment.findFirst({
      where: { memberId, status: "ACCREDITED", accreditedAt: { lte: now } },
      orderBy: [{ accreditedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      select: { id: true, accreditedAt: true, expiresAt: true },
    });
  }
}
