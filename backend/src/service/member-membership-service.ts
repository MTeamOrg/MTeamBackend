import { calculateDaysRemaining, calculateMembershipStatus, type MembershipStatus } from "../model/membership-status.js";
import type { MembershipPriceRepositoryPort } from "../repository/membership-price-repository.js";
import type { MemberMembershipRepositoryPort } from "../repository/member-membership-repository.js";

export interface OwnMembership {
  currentPrice: string | null;
  lastPaymentAt: Date | null;
  expiresAt: Date | null;
  daysRemaining: number;
  status: MembershipStatus;
}

export class MemberMembershipService {
  constructor(
    private readonly membershipRepository: MemberMembershipRepositoryPort,
    private readonly priceRepository: Pick<MembershipPriceRepositoryPort, "findCurrentPrice">,
  ) {}

  async getOwnMembership(memberId: string, now = new Date()): Promise<OwnMembership> {
    const [payment, price] = await Promise.all([
      this.membershipRepository.findLatestAccreditedPayment(memberId, now),
      this.priceRepository.findCurrentPrice(now),
    ]);
    const expiresAt = payment?.expiresAt ?? null;

    return {
      currentPrice: price?.amount.toString() ?? null,
      lastPaymentAt: payment?.accreditedAt ?? null,
      expiresAt,
      daysRemaining: calculateDaysRemaining(expiresAt, now),
      status: calculateMembershipStatus(expiresAt, now),
    };
  }
}
