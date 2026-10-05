import type { PrismaClient, UserRole, UserStatus } from "../generated/prisma/client.js";
import type { ListAccessAttemptsQuery } from "../validator/access-attempt-validator.js";

export interface AccessAttemptActor {
  id: string;
  role: UserRole;
  status: UserStatus;
}

const accessAttemptInclude = {
  user: { select: { id: true, firstName: true, lastName: true, documentNumber: true } },
  branch: { select: { id: true, name: true } },
  accessPoint: { select: { id: true, name: true } },
} as const;

export class AccessAttemptRepository {
  constructor(private readonly database: PrismaClient) {}

  findActor(id: string): Promise<AccessAttemptActor | null> {
    return this.database.user.findUnique({ where: { id }, select: { id: true, role: true, status: true } });
  }

  findAccessPoint(qrToken: string) {
    return this.database.accessPoint.findUnique({
      where: { qrToken },
      include: { branch: true },
    });
  }

  findMembership(userId: string, now: Date) {
    return this.database.payment.findFirst({
      where: { memberId: userId, status: "ACCREDITED", accreditedAt: { lte: now } },
      orderBy: [{ accreditedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      select: { expiresAt: true },
    });
  }

  findFirstAccreditedPayment(userId: string, now: Date) {
    return this.database.payment.findFirst({
      where: { memberId: userId, status: "ACCREDITED", accreditedAt: { lte: now } },
      orderBy: [{ accreditedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: { accreditedAt: true },
    });
  }

  findApprovedMedicalCertificate(userId: string) {
    return this.database.medicalCertificate.findFirst({
      where: { memberId: userId, status: "APPROVED" }, select: { id: true },
    });
  }

  create(data: {
    userId: string; roleAtAttempt: "MEMBER" | "TRAINER"; branchId: string | null;
    accessPointId: string | null; result: "ALLOWED" | "DENIED"; denialReason:
      "INVALID_QR" | "INACTIVE_USER" | "INACTIVE_BRANCH" | "INACTIVE_ACCESS_POINT" | "EXPIRED_MEMBERSHIP" | "MEDICAL_CERTIFICATE_REQUIRED" | null;
    attemptedAt: Date;
  }) {
    return this.database.accessLog.create({ data, include: accessAttemptInclude });
  }

  async list(query: ListAccessAttemptsQuery) {
    const where = {
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.search ? { user: { OR: [
        { firstName: { contains: query.search, mode: "insensitive" as const } },
        { lastName: { contains: query.search, mode: "insensitive" as const } },
        { documentNumber: { contains: query.search, mode: "insensitive" as const } },
      ] } } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.role ? { roleAtAttempt: query.role } : {}),
      ...(query.result ? { result: query.result } : {}),
      ...((query.from || query.to) ? { attemptedAt: {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      } } : {}),
    };
    const [total, items] = await this.database.$transaction([
      this.database.accessLog.count({ where }),
      this.database.accessLog.findMany({ where, include: accessAttemptInclude,
        orderBy: [{ attemptedAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.limit, take: query.limit }),
    ]);
    return { items, page: query.page, limit: query.limit, total };
  }
}
