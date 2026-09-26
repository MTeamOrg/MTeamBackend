import { randomUUID } from "node:crypto";

import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import { calculateInitialMedicalCertificatePeriod } from "../model/initial-medical-certificate-period.js";
import {
  MedicalCertificateAlreadyReviewedError,
  MedicalCertificateMemberNotFoundError,
  MedicalCertificateNotFoundError,
  MedicalCertificateReviewCommentRequiredError,
  MedicalCertificateUploadNotAllowedError,
  type MedicalCertificateRecord,
  type MedicalCertificateRepositoryPort,
} from "../repository/medical-certificate-repository.js";
import type { InitialMedicalCertificatePeriodRepositoryPort } from "../repository/member-membership-repository.js";
import type {
  AdminMedicalCertificateListQuery,
  MedicalReviewInput,
  OwnMedicalCertificateListQuery,
} from "../validator/medical-certificate-validator.js";
import type { UserRole } from "../generated/prisma/client.js";

export const MEDICAL_CERTIFICATE_SIGNED_URL_EXPIRES_IN_SECONDS = 300;

export interface MedicalCertificateStorageFile {
  buffer: Buffer;
  mimeType: string;
}

export interface MedicalCertificateStorage {
  upload(path: string, file: MedicalCertificateStorageFile): Promise<void>;
  createSignedUrl(path: string): Promise<string>;
  remove(path: string): Promise<void>;
}

export interface MedicalCertificateRequester {
  id: string;
  role: UserRole;
}

export interface OwnMedicalCertificateList {
  items: MedicalCertificateRecord[];
  page: number;
  limit: number;
  total: number;
  initialMedicalCertificatePeriod: ReturnType<typeof calculateInitialMedicalCertificatePeriod>;
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === "application/pdf") return ".pdf";
  if (mimeType === "image/png") return ".png";
  return ".jpg";
}

export class MedicalCertificateService {
  constructor(
    private readonly repository: MedicalCertificateRepositoryPort,
    private readonly membershipRepository: InitialMedicalCertificatePeriodRepositoryPort,
    private readonly storage: MedicalCertificateStorage,
  ) {}

  async listOwn(
    memberId: string,
    query: OwnMedicalCertificateListQuery,
    now = new Date(),
  ): Promise<OwnMedicalCertificateList> {
    const [list, firstPayment] = await Promise.all([
      this.repository.listOwn(memberId, query),
      this.membershipRepository.findEarliestAccreditedPayment(memberId, now),
    ]);
    return {
      ...list,
      initialMedicalCertificatePeriod: calculateInitialMedicalCertificatePeriod(
        firstPayment?.accreditedAt ?? null,
        now,
      ),
    };
  }

  listAdmin(query: AdminMedicalCertificateListQuery) {
    return this.repository.listAdmin(query);
  }

  async get(certificateId: string, requester: MedicalCertificateRequester) {
    const certificate = await this.findAndAuthorize(certificateId, requester);
    return certificate;
  }

  async getFile(certificateId: string, requester: MedicalCertificateRequester) {
    const certificate = await this.findAndAuthorize(certificateId, requester);
    return {
      signedUrl: await this.storage.createSignedUrl(certificate.fileUrl),
      expiresIn: MEDICAL_CERTIFICATE_SIGNED_URL_EXPIRES_IN_SECONDS,
    };
  }

  async upload(memberId: string, file: MedicalCertificateStorageFile) {
    const path = `${memberId}/${randomUUID()}${extensionForMimeType(file.mimeType)}`;
    await this.storage.upload(path, file);
    try {
      return await this.repository.createPending(memberId, path);
    } catch (error: unknown) {
      try {
        await this.storage.remove(path);
      } catch {
        // Keep the original domain error; cleanup is best effort after a failed transaction.
      }
      throw this.toApplicationError(error);
    }
  }

  async review(certificateId: string, administratorId: string, input: MedicalReviewInput) {
    try {
      return await this.repository.review(certificateId, administratorId, input);
    } catch (error: unknown) {
      throw this.toApplicationError(error);
    }
  }

  private async findAndAuthorize(
    certificateId: string,
    requester: MedicalCertificateRequester,
  ): Promise<MedicalCertificateRecord> {
    const certificate = await this.repository.findById(certificateId);
    if (!certificate) throw new ApplicationError(404, ERROR_CODE.NOT_FOUND, "El apto médico no existe");
    if (requester.role !== "ADMIN" && certificate.memberId !== requester.id) {
      throw new ApplicationError(403, ERROR_CODE.FORBIDDEN, "No tiene permisos para acceder a este apto médico");
    }
    return certificate;
  }

  private toApplicationError(error: unknown): Error {
    if (error instanceof MedicalCertificateNotFoundError ||
      error instanceof MedicalCertificateMemberNotFoundError) {
      return new ApplicationError(404, ERROR_CODE.NOT_FOUND, "El apto médico no existe");
    }
    if (error instanceof MedicalCertificateUploadNotAllowedError) {
      return new ApplicationError(409, ERROR_CODE.CONFLICT,
        "Sólo puede cargar un nuevo apto médico después de un rechazo");
    }
    if (error instanceof MedicalCertificateAlreadyReviewedError) {
      return new ApplicationError(409, ERROR_CODE.CONFLICT,
        "El apto médico ya fue revisado");
    }
    if (error instanceof MedicalCertificateReviewCommentRequiredError) {
      return new ApplicationError(400, ERROR_CODE.VALIDATION_ERROR,
        "El rechazo requiere una observación");
    }
    return error instanceof Error ? error : new Error("Error desconocido");
  }
}
