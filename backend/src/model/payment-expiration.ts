const MEMBERSHIP_VALIDITY_DAYS = 30;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function calculatePaymentExpiresAt(accreditedAt: Date): Date {
  return new Date(accreditedAt.getTime() + MEMBERSHIP_VALIDITY_DAYS * MILLISECONDS_PER_DAY);
}
