const INITIAL_PERIOD_DAYS = 20;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export interface InitialMedicalCertificatePeriod {
  startsAt: Date | null;
  expiresAt: Date | null;
  daysRemaining: number;
  isActive: boolean;
}

export function calculateInitialMedicalCertificatePeriod(
  firstValidPaymentAt: Date | null,
  now: Date,
): InitialMedicalCertificatePeriod {
  if (!firstValidPaymentAt || firstValidPaymentAt.getTime() > now.getTime()) {
    return { startsAt: null, expiresAt: null, daysRemaining: 0, isActive: false };
  }
  const expiresAt = new Date(firstValidPaymentAt.getTime() + INITIAL_PERIOD_DAYS * MILLISECONDS_PER_DAY);
  const remaining = expiresAt.getTime() - now.getTime();
  return {
    startsAt: firstValidPaymentAt,
    expiresAt,
    daysRemaining: Math.max(0, Math.ceil(remaining / MILLISECONDS_PER_DAY)),
    isActive: remaining > 0,
  };
}
