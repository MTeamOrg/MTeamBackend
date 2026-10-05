import { AccessAttemptService } from "../../src/service/access-attempt-service.js";
import type { AccessAttemptRepository } from "../../src/repository/access-attempt-repository.js";

describe("AccessAttemptService", () => {
  const now = new Date("2026-10-05T12:00:00.000Z");
  const activePoint = { id: "point-id", branchId: "branch-id", isActive: true, branch: { isActive: true } };

  function setup(overrides: Record<string, unknown> = {}) {
    const repository = {
      findActor: jest.fn().mockResolvedValue({ id: "member-id", role: "MEMBER", status: "ACTIVE" }),
      findAccessPoint: jest.fn().mockResolvedValue(activePoint),
      findMembership: jest.fn().mockResolvedValue({ expiresAt: new Date("2026-10-20T12:00:00.000Z") }),
      findFirstAccreditedPayment: jest.fn().mockResolvedValue({ accreditedAt: new Date("2026-10-01T12:00:00.000Z") }),
      findApprovedMedicalCertificate: jest.fn().mockResolvedValue(null),
      create: jest.fn(async (data) => ({ id: "attempt-id", ...data })),
      ...overrides,
    };
    return { repository, service: new AccessAttemptService(repository as unknown as AccessAttemptRepository) };
  }

  it("allows a member during the first 20 days without an approved certificate", async () => {
    const { repository, service } = setup();
    const attempt = await service.create("member-id", "fixed-token", now);
    expect(attempt).toMatchObject({ result: "ALLOWED", denialReason: null, branchId: "branch-id", accessPointId: "point-id" });
  });

  it("denies a member with expired membership", async () => {
    const { repository, service } = setup({ findMembership: jest.fn().mockResolvedValue({ expiresAt: now }) });
    const attempt = await service.create("member-id", "fixed-token", now);
    expect(attempt).toMatchObject({ result: "DENIED", denialReason: "EXPIRED_MEMBERSHIP" });
    expect(repository.findApprovedMedicalCertificate).not.toHaveBeenCalled();
  });

  it("requires an approved certificate after the initial period", async () => {
    const { service } = setup({ findFirstAccreditedPayment: jest.fn().mockResolvedValue({ accreditedAt: new Date("2026-09-01T12:00:00.000Z") }) });
    await expect(service.create("member-id", "fixed-token", now)).resolves.toMatchObject({
      result: "DENIED", denialReason: "MEDICAL_CERTIFICATE_REQUIRED",
    });
  });

  it("records unknown QR values without associating a location", async () => {
    const { service } = setup({ findAccessPoint: jest.fn().mockResolvedValue(null) });
    await expect(service.create("member-id", "altered-token", now)).resolves.toMatchObject({
      result: "DENIED", denialReason: "INVALID_QR", branchId: null, accessPointId: null,
    });
  });

  it("records scanned QR content longer than the persisted token limit as invalid", async () => {
    const { repository, service } = setup();
    await expect(service.create("member-id", "x".repeat(256), now)).resolves.toMatchObject({
      result: "DENIED", denialReason: "INVALID_QR", branchId: null, accessPointId: null,
    });
    expect(repository.findAccessPoint).not.toHaveBeenCalled();
  });

  it("denies inactive accounts and inactive points", async () => {
    const inactiveUser = setup({ findActor: jest.fn().mockResolvedValue({ id: "member-id", role: "MEMBER", status: "INACTIVE" }) });
    await expect(inactiveUser.service.create("member-id", "fixed-token", now)).resolves.toMatchObject({ denialReason: "INACTIVE_USER" });
    const inactivePoint = setup({ findAccessPoint: jest.fn().mockResolvedValue({ ...activePoint, isActive: false }) });
    await expect(inactivePoint.service.create("member-id", "fixed-token", now)).resolves.toMatchObject({ denialReason: "INACTIVE_ACCESS_POINT" });
  });

  it("allows active trainers without membership or medical-certificate checks", async () => {
    const { repository, service } = setup({ findActor: jest.fn().mockResolvedValue({ id: "trainer-id", role: "TRAINER", status: "ACTIVE" }) });
    await expect(service.create("trainer-id", "fixed-token", now)).resolves.toMatchObject({ result: "ALLOWED" });
    expect(repository.findMembership).not.toHaveBeenCalled();
  });
});
