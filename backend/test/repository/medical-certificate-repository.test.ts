import type { PrismaClient } from "../../src/generated/prisma/client.js";
import {
  MedicalCertificateAlreadyReviewedError,
  MedicalCertificateRepository,
  MedicalCertificateUploadNotAllowedError,
} from "../../src/repository/medical-certificate-repository.js";

const memberId = "212a6da6-063c-44c9-b63c-1d67602cb487";
const certificateId = "f12101a5-e6ab-43f7-91b3-2b8fbfd67b84";
const record = {
  id: certificateId, memberId, fileUrl: "medical-certificates/member/file.pdf", status: "PENDING",
  uploadedAt: new Date(), reviewedById: null, reviewedAt: null, reviewComment: null,
  member: { id: memberId, firstName: "Ana", lastName: "Pérez", documentNumber: "123", email: "a@e.com" },
  reviewedBy: null,
};

function setup() {
  const queryRaw = jest.fn().mockResolvedValue([{ id: memberId }]);
  const userFindUnique = jest.fn().mockResolvedValue({ role: "MEMBER" });
  const certificateFindFirst = jest.fn().mockResolvedValue(null);
  const certificateFindUnique = jest.fn().mockResolvedValue({ status: "PENDING" });
  const create = jest.fn().mockResolvedValue(record);
  const update = jest.fn().mockResolvedValue(record);
  const transaction = {
    $queryRaw: queryRaw,
    user: { findUnique: userFindUnique },
    medicalCertificate: { findFirst: certificateFindFirst, findUnique: certificateFindUnique, create, update },
  };
  const database = {
    $transaction: jest.fn().mockImplementation((callback: (tx: typeof transaction) => unknown) => callback(transaction)),
  } as unknown as PrismaClient;
  return { repository: new MedicalCertificateRepository(database), queryRaw, userFindUnique,
    certificateFindFirst, certificateFindUnique, create, update };
}

describe("medical certificate repository", () => {
  test("creates a pending certificate atomically and locks the member", async () => {
    const state = setup();
    await expect(state.repository.createPending(memberId, "medical-certificates/member/file.pdf"))
      .resolves.toEqual(record);
    expect(state.queryRaw).toHaveBeenCalled();
    expect(state.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { memberId, fileUrl: "medical-certificates/member/file.pdf", status: "PENDING" },
    }));
  });

  test("does not allow a second pending or approved document", async () => {
    const state = setup();
    state.certificateFindFirst.mockResolvedValue({ status: "PENDING" });
    await expect(state.repository.createPending(memberId, "path"))
      .rejects.toBeInstanceOf(MedicalCertificateUploadNotAllowedError);
    expect(state.create).not.toHaveBeenCalled();
  });

  test("reviews only pending documents and records the reviewer atomically", async () => {
    const state = setup();
    await expect(state.repository.review(certificateId, "admin-id", {
      status: "APPROVED",
    })).resolves.toEqual(record);
    expect(state.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: certificateId },
      data: expect.objectContaining({ status: "APPROVED", reviewedById: "admin-id" }),
    }));
  });

  test("does not review a certificate twice", async () => {
    const state = setup();
    state.certificateFindUnique.mockResolvedValue({ status: "APPROVED" });
    await expect(state.repository.review(certificateId, "admin-id", { status: "APPROVED" }))
      .rejects.toBeInstanceOf(MedicalCertificateAlreadyReviewedError);
    expect(state.update).not.toHaveBeenCalled();
  });
});
