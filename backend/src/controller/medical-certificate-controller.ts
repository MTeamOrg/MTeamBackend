import type { RequestHandler } from "express";

import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import { MedicalCertificateService } from "../service/medical-certificate-service.js";
import {
  adminMedicalCertificateListQuerySchema,
  medicalCertificateIdParamsSchema,
  medicalReviewSchema,
  ownMedicalCertificateListQuerySchema,
} from "../validator/medical-certificate-validator.js";

function serializeCertificate(certificate: Awaited<ReturnType<MedicalCertificateService["get"]>>) {
  return {
    id: certificate.id,
    memberId: certificate.memberId,
    status: certificate.status,
    uploadedAt: certificate.uploadedAt.toISOString(),
    reviewedAt: certificate.reviewedAt?.toISOString() ?? null,
    reviewComment: certificate.reviewComment,
    member: certificate.member,
    reviewedBy: certificate.reviewedBy,
  };
}

function serializePeriod(period: {
  startsAt: Date | null;
  expiresAt: Date | null;
  daysRemaining: number;
  isActive: boolean;
}) {
  return {
    startsAt: period.startsAt?.toISOString() ?? null,
    expiresAt: period.expiresAt?.toISOString() ?? null,
    daysRemaining: period.daysRemaining,
    isActive: period.isActive,
  };
}

export class MedicalCertificateController {
  constructor(private readonly service: MedicalCertificateService) {}

  listOwn: RequestHandler = async (request, response) => {
    const validation = ownMedicalCertificateListQuerySchema.safeParse(request.query);
    if (!validation.success) throw this.invalidQuery(validation.error.flatten());
    const result = await this.service.listOwn(request.authenticatedUser!.id, validation.data);
    response.status(200).json({
      ...result,
      items: result.items.map(serializeCertificate),
      initialMedicalCertificatePeriod: serializePeriod(result.initialMedicalCertificatePeriod),
    });
  };

  upload: RequestHandler = async (request, response) => {
    if (!request.file) {
      throw new ApplicationError(400, ERROR_CODE.VALIDATION_ERROR,
        "Debe adjuntar un archivo de apto médico");
    }
    const certificate = await this.service.upload(request.authenticatedUser!.id, {
      buffer: request.file.buffer,
      mimeType: request.file.mimetype,
    });
    response.status(201).json(serializeCertificate(certificate));
  };

  listAdmin: RequestHandler = async (request, response) => {
    const validation = adminMedicalCertificateListQuerySchema.safeParse(request.query);
    if (!validation.success) throw this.invalidQuery(validation.error.flatten());
    const result = await this.service.listAdmin(validation.data);
    response.status(200).json({ ...result, items: result.items.map(serializeCertificate) });
  };

  get: RequestHandler = async (request, response) => {
    const params = this.parseParams(request.params);
    const certificate = await this.service.get(params.certificateId, request.authenticatedUser!);
    response.status(200).json(serializeCertificate(certificate));
  };

  getFile: RequestHandler = async (request, response) => {
    const params = this.parseParams(request.params);
    response.status(200).json(await this.service.getFile(params.certificateId, request.authenticatedUser!));
  };

  review: RequestHandler = async (request, response) => {
    const params = this.parseParams(request.params);
    const validation = medicalReviewSchema.safeParse(request.body);
    if (!validation.success) throw this.invalidQuery(validation.error.flatten());
    const certificate = await this.service.review(
      params.certificateId,
      request.authenticatedUser!.id,
      validation.data,
    );
    response.status(200).json(serializeCertificate(certificate));
  };

  private parseParams(params: unknown) {
    const validation = medicalCertificateIdParamsSchema.safeParse(params);
    if (!validation.success) throw this.invalidQuery(validation.error.flatten());
    return validation.data;
  }

  private invalidQuery(details: unknown) {
    return new ApplicationError(400, ERROR_CODE.VALIDATION_ERROR,
      "Los datos del apto médico no son válidos", details);
  }
}
