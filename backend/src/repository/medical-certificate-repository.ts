import type { MedicalCertificate, Prisma, PrismaClient } from "../generated/prisma/client.js";
import type {
  AdminMedicalCertificateListQuery,
  MedicalReviewInput,
  OwnMedicalCertificateListQuery,
} from "../validator/medical-certificate-validator.js";

export class MedicalCertificateNotFoundError extends Error {}
export class MedicalCertificateMemberNotFoundError extends Error {}
export class MedicalCertificateUploadNotAllowedError extends Error {}
export class MedicalCertificateAlreadyReviewedError extends Error {}
export class MedicalCertificateReviewCommentRequiredError extends Error {}

const medicalCertificateSelect = {
  id: true,
  memberId: true,
  fileUrl: true,
  status: true,
  uploadedAt: true,
  reviewedById: true,
  reviewedAt: true,
  reviewComment: true,
  member: {
    select: { id: true, firstName: true, lastName: true, documentNumber: true, email: true },
  },
  reviewedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
} as const satisfies Prisma.MedicalCertificateSelect;

export type MedicalCertificateRecord = Prisma.MedicalCertificateGetPayload<{
  select: typeof medicalCertificateSelect;
}>;

export interface MedicalCertificateList {
  items: MedicalCertificateRecord[];
  page: number;
  limit: number;
  total: number;
}

export interface MedicalCertificateRepositoryPort {
  listOwn(memberId: string, query: OwnMedicalCertificateListQuery): Promise<MedicalCertificateList>;
  listAdmin(query: AdminMedicalCertificateListQuery): Promise<MedicalCertificateList>;
  findById(id: string): Promise<MedicalCertificateRecord | null>;
  createPending(memberId: string, filePath: string): Promise<MedicalCertificateRecord>;
  review(
    certificateId: string,
    administratorId: string,
    input: MedicalReviewInput,
  ): Promise<MedicalCertificateRecord>;
}

export class MedicalCertificateRepository implements MedicalCertificateRepositoryPort {
  constructor(private readonly database: PrismaClient) {}

  async listOwn(memberId: string, query: OwnMedicalCertificateListQuery): Promise<MedicalCertificateList> {
    const where = { memberId };
    const [total, items] = await this.database.$transaction([
      this.database.medicalCertificate.count({ where }),
      this.database.medicalCertificate.findMany({
        where,
        orderBy: [{ uploadedAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: medicalCertificateSelect,
      }),
    ]);
    return { items, page: query.page, limit: query.limit, total };
  }

  async listAdmin(query: AdminMedicalCertificateListQuery): Promise<MedicalCertificateList> {
    const where: Prisma.MedicalCertificateWhereInput = {};
    if (query.memberId) where.memberId = query.memberId;
    if (query.status) where.status = query.status;
    if (query.from || query.to) {
      where.uploadedAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lt: new Date(query.to) } : {}),
      };
    }
    if (query.search) {
      where.member = {
        is: {
          OR: [
            { firstName: { contains: query.search, mode: "insensitive" } },
            { lastName: { contains: query.search, mode: "insensitive" } },
            { documentNumber: { contains: query.search, mode: "insensitive" } },
            { email: { contains: query.search, mode: "insensitive" } },
          ],
        },
      };
    }

    const [total, items] = await this.database.$transaction([
      this.database.medicalCertificate.count({ where }),
      this.database.medicalCertificate.findMany({
        where,
        orderBy: [{ uploadedAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: medicalCertificateSelect,
      }),
    ]);
    return { items, page: query.page, limit: query.limit, total };
  }

  findById(id: string): Promise<MedicalCertificateRecord | null> {
    return this.database.medicalCertificate.findUnique({
      where: { id },
      select: medicalCertificateSelect,
    });
  }

  async createPending(memberId: string, filePath: string): Promise<MedicalCertificateRecord> {
    return this.database.$transaction(async (transaction) => {
      await transaction.$queryRaw<{ id: string }[]>`
        SELECT id FROM "user" WHERE id = ${memberId}::uuid FOR UPDATE
      `;
      const member = await transaction.user.findUnique({
        where: { id: memberId },
        select: { role: true },
      });
      if (!member || member.role !== "MEMBER") {
        throw new MedicalCertificateMemberNotFoundError();
      }

      const latest = await transaction.medicalCertificate.findFirst({
        where: { memberId },
        orderBy: [{ uploadedAt: "desc" }, { id: "desc" }],
        select: { status: true },
      });
      if (latest && latest.status !== "REJECTED") {
        throw new MedicalCertificateUploadNotAllowedError();
      }

      return transaction.medicalCertificate.create({
        data: { memberId, fileUrl: filePath, status: "PENDING" },
        select: medicalCertificateSelect,
      });
    });
  }

  async review(
    certificateId: string,
    administratorId: string,
    input: MedicalReviewInput,
  ): Promise<MedicalCertificateRecord> {
    if (input.status === "REJECTED" && !input.reviewComment) {
      throw new MedicalCertificateReviewCommentRequiredError();
    }

    return this.database.$transaction(async (transaction) => {
      await transaction.$queryRaw<{ id: string }[]>`
        SELECT id FROM "medical_certificate" WHERE id = ${certificateId}::uuid FOR UPDATE
      `;
      const current = await transaction.medicalCertificate.findUnique({
        where: { id: certificateId },
        select: { status: true },
      });
      if (!current) throw new MedicalCertificateNotFoundError();
      if (current.status !== "PENDING") throw new MedicalCertificateAlreadyReviewedError();

      return transaction.medicalCertificate.update({
        where: { id: certificateId },
        data: {
          status: input.status,
          reviewedById: administratorId,
          reviewedAt: new Date(),
          reviewComment: input.reviewComment?.trim() || null,
        },
        select: medicalCertificateSelect,
      });
    });
  }
}
