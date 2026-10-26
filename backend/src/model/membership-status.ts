export type MembershipStatus = "CURRENT" | "EXPIRING_SOON" | "EXPIRED";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
export const EXPIRING_SOON_DAYS = 5;

export function calculateMembershipStatus(expiresAt: Date | null, now: Date): MembershipStatus {
  if (!expiresAt || expiresAt.getTime() <= now.getTime()) return "EXPIRED";
  if (expiresAt.getTime() - now.getTime() <= EXPIRING_SOON_DAYS * MILLISECONDS_PER_DAY) {
    return "EXPIRING_SOON";
  }
  return "CURRENT";
}

export function calculateDaysRemaining(expiresAt: Date | null, now: Date): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / MILLISECONDS_PER_DAY));
}
