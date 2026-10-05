import type { AccessAttemptRepository } from "../repository/access-attempt-repository.js";
import type { ListAccessAttemptsQuery } from "../validator/access-attempt-validator.js";

const INITIAL_CERTIFICATE_PERIOD_MS = 20 * 24 * 60 * 60 * 1000;

export class AccessAttemptService {
  constructor(private readonly repository: AccessAttemptRepository) {}

  async create(userId: string, qrToken: string, now = new Date()) {
    const actor = await this.repository.findActor(userId);
    if (!actor || (actor.role !== "MEMBER" && actor.role !== "TRAINER")) {
      throw new Error("Authenticated access actor is unavailable");
    }
    const point = await this.repository.findAccessPoint(qrToken);
    let reason: "INVALID_QR" | "INACTIVE_USER" | "INACTIVE_BRANCH" | "INACTIVE_ACCESS_POINT" | "EXPIRED_MEMBERSHIP" | "MEDICAL_CERTIFICATE_REQUIRED" | null = null;
    if (!point) reason = "INVALID_QR";
    else if (actor.status !== "ACTIVE") reason = "INACTIVE_USER";
    else if (!point.branch.isActive) reason = "INACTIVE_BRANCH";
    else if (!point.isActive) reason = "INACTIVE_ACCESS_POINT";
    else if (actor.role === "MEMBER") {
      const payment = await this.repository.findMembership(userId, now);
      if (!payment || payment.expiresAt.getTime() <= now.getTime()) {
        reason = "EXPIRED_MEMBERSHIP";
      } else {
        const [firstPayment, approvedCertificate] = await Promise.all([
          this.repository.findFirstAccreditedPayment(userId, now),
          this.repository.findApprovedMedicalCertificate(userId),
        ]);
        const initialPeriodIsActive = firstPayment !== null
          && now.getTime() < firstPayment.accreditedAt.getTime() + INITIAL_CERTIFICATE_PERIOD_MS;
        if (!approvedCertificate && !initialPeriodIsActive) reason = "MEDICAL_CERTIFICATE_REQUIRED";
      }
    }
    const invalidQr = reason === "INVALID_QR";
    return this.repository.create({
      userId, roleAtAttempt: actor.role,
      branchId: invalidQr ? null : point!.branchId,
      accessPointId: invalidQr ? null : point!.id,
      result: reason ? "DENIED" : "ALLOWED", denialReason: reason, attemptedAt: now,
    });
  }

  list(query: ListAccessAttemptsQuery) { return this.repository.list(query); }
}
