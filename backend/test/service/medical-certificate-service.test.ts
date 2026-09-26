import { ApplicationError } from "../../src/error/application-error.js";
import type { MedicalCertificateRepositoryPort } from "../../src/repository/medical-certificate-repository.js";
import { MedicalCertificateUploadNotAllowedError } from "../../src/repository/medical-certificate-repository.js";
import type { InitialMedicalCertificatePeriodRepositoryPort } from "../../src/repository/member-membership-repository.js";
import { MedicalCertificateService } from "../../src/service/medical-certificate-service.js";
import type { MedicalCertificateStorage } from "../../src/service/medical-certificate-service.js";

const memberId = "212a6da6-063c-44c9-b63c-1d67602cb487";
const otherMemberId = "312a6da6-063c-44c9-b63c-1d67602cb487";
const certificateId = "f12101a5-e6ab-43f7-91b3-2b8fbfd67b84";

const certificate = {
  id: certificateId,
  memberId,
  fileUrl: `medical-certificates/${memberId}/certificate.pdf`,
  status: "PENDING" as const,
  uploadedAt: new Date("2030-09-01T12:00:00.000Z"),
  reviewedById: null,
  reviewedAt: null,
  reviewComment: null,
  member: { id: memberId, firstName: "Ana", lastName: "Pérez", documentNumber: "123", email: "ana@example.com" },
  reviewedBy: null,
};

function setup() {
  const repository = {
    listOwn: jest.fn().mockResolvedValue({ items: [certificate], page: 1, limit: 20, total: 1 }),
    listAdmin: jest.fn().mockResolvedValue({ items: [certificate], page: 1, limit: 20, total: 1 }),
    findById: jest.fn().mockResolvedValue(certificate),
    createPending: jest.fn().mockResolvedValue(certificate),
    review: jest.fn().mockResolvedValue(certificate),
  } as unknown as jest.Mocked<MedicalCertificateRepositoryPort>;
  const membershipRepository = {
    findEarliestAccreditedPayment: jest.fn().mockResolvedValue({
      id: "payment-id",
      accreditedAt: new Date("2030-09-01T12:00:00.000Z"),
      expiresAt: new Date("2030-10-01T12:00:00.000Z"),
    }),
  } as unknown as jest.Mocked<InitialMedicalCertificatePeriodRepositoryPort>;
  const storage: jest.Mocked<MedicalCertificateStorage> = {
    upload: jest.fn().mockResolvedValue(undefined),
    createSignedUrl: jest.fn().mockResolvedValue("https://signed.example/certificate"),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  return {
    service: new MedicalCertificateService(repository, membershipRepository, storage),
    repository,
    membershipRepository,
    storage,
  };
}

describe("medical certificate service", () => {
  test("returns the own history and reuses the initial payment period", async () => {
    const { service, membershipRepository } = setup();
    const now = new Date("2030-09-02T12:00:00.000Z");
    const result = await service.listOwn(memberId, { page: 1, limit: 20 }, now);

    expect(result.items).toHaveLength(1);
    expect(result.initialMedicalCertificatePeriod.isActive).toBe(true);
    expect(result.initialMedicalCertificatePeriod.daysRemaining).toBe(19);
    expect(membershipRepository.findEarliestAccreditedPayment)
      .toHaveBeenCalledWith(memberId, now);
  });

  test("allows only the owner or an administrator to access the file", async () => {
    const { service, storage } = setup();
    await expect(service.getFile(certificateId, { id: otherMemberId, role: "MEMBER" }))
      .rejects.toEqual(expect.objectContaining<ApplicationError>({ statusCode: 403 }));
    await expect(service.getFile(certificateId, { id: memberId, role: "MEMBER" }))
      .resolves.toEqual({ signedUrl: "https://signed.example/certificate", expiresIn: 300 });
    await expect(service.getFile(certificateId, { id: "admin-id", role: "ADMIN" }))
      .resolves.toBeDefined();
    expect(storage.createSignedUrl).toHaveBeenCalledWith(certificate.fileUrl);
  });

  test("cleans up the private object when the pending record cannot be created", async () => {
    const { service, repository, storage } = setup();
    repository.createPending.mockRejectedValue(new MedicalCertificateUploadNotAllowedError());

    await expect(service.upload(memberId, { buffer: Buffer.from("%PDF-1.7"), mimeType: "application/pdf" }))
      .rejects.toEqual(expect.objectContaining<ApplicationError>({ statusCode: 409 }));
    expect(storage.upload).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^${memberId}/.*\\.pdf$`)),
      expect.anything(),
    );
    expect(storage.remove).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^${memberId}/`)));
  });

  test("persists the same relative object path that was uploaded", async () => {
    const { service, repository, storage } = setup();

    await service.upload(memberId, { buffer: Buffer.from("%PDF-1.7"), mimeType: "application/pdf" });

    const uploadedPath = storage.upload.mock.calls[0]?.[0];
    expect(uploadedPath).toMatch(new RegExp(`^${memberId}/.*\\.pdf$`));
    expect(repository.createPending).toHaveBeenCalledWith(memberId, uploadedPath);
  });
});
