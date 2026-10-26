import type { PrismaClient } from "../generated/prisma/client.js";
import { EXPIRING_SOON_DAYS } from "../model/membership-status.js";

export interface AdminDashboardMetrics {
  activeMembers: number;
  inactiveMembers: number;
  currentMemberships: number;
  expiringMemberships: number;
  expiredMemberships: number;
  pendingMedicalCertificates: number;
  rejectedMedicalCertificates: number;
  initialPeriodMembers: number;
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export interface AdminDashboardRepositoryPort {
  getMetrics(now: Date): Promise<AdminDashboardMetrics>;
}

export class AdminDashboardRepository implements AdminDashboardRepositoryPort {
  constructor(private readonly database: PrismaClient) {}

  async getMetrics(now: Date): Promise<AdminDashboardMetrics> {
    const validPayment = {
      status: "ACCREDITED" as const,
      accreditedAt: { lte: now },
    };
    const soonBoundary = new Date(
      now.getTime() + EXPIRING_SOON_DAYS * MILLISECONDS_PER_DAY,
    );
    const paymentAfter = (date: Date) => ({
      ...validPayment,
      expiresAt: { gt: date },
    });
    const member = { role: "MEMBER" as const };

    const [
      activeMembers,
      inactiveMembers,
      currentMemberships,
      expiringMemberships,
      expiredMemberships,
      pendingMedicalCertificates,
      rejectedMedicalCertificates,
      initialPeriodRows,
    ] = await Promise.all([
      this.database.user.count({ where: { ...member, status: "ACTIVE" } }),
      this.database.user.count({ where: { ...member, status: "INACTIVE" } }),
      this.database.user.count({
        where: { ...member, memberPayments: { some: paymentAfter(soonBoundary) } },
      }),
      this.database.user.count({
        where: {
          ...member,
          memberPayments: {
            some: paymentAfter(now),
            none: paymentAfter(soonBoundary),
          },
        },
      }),
      this.database.user.count({
        where: { ...member, memberPayments: { none: paymentAfter(now) } },
      }),
      this.database.medicalCertificate.count({ where: { status: "PENDING" } }),
      this.database.medicalCertificate.count({ where: { status: "REJECTED" } }),
      this.database.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM (
          SELECT p.member_id
          FROM payment p
          INNER JOIN "user" u ON u.id = p.member_id
          WHERE p.status = 'ACCREDITED'
            AND p.accredited_at <= ${now}
            AND u.role = 'MEMBER'
          GROUP BY p.member_id
          HAVING MIN(p.accredited_at) + INTERVAL '20 days' > ${now}
        ) initial_period_members
      `,
    ]);

    return {
      activeMembers,
      inactiveMembers,
      currentMemberships,
      expiringMemberships,
      expiredMemberships,
      pendingMedicalCertificates,
      rejectedMedicalCertificates,
      initialPeriodMembers: Number(initialPeriodRows[0]?.count ?? 0),
    };
  }
}
