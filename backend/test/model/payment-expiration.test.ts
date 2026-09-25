import { calculatePaymentExpiresAt } from "../../src/model/payment-expiration.js";

describe("payment expiration", () => {
  test("adds exactly 30 elapsed days across month and year boundaries", () => {
    const accreditedAt = new Date("2026-12-20T23:30:45.123-03:00");
    const expiresAt = calculatePaymentExpiresAt(accreditedAt);

    expect(expiresAt.toISOString()).toBe("2027-01-20T02:30:45.123Z");
    expect(expiresAt.getTime() - accreditedAt.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
  });

  test("does not mutate the accreditation instant", () => {
    const accreditedAt = new Date("2026-09-25T12:00:00.000Z");
    const originalTime = accreditedAt.getTime();

    calculatePaymentExpiresAt(accreditedAt);

    expect(accreditedAt.getTime()).toBe(originalTime);
  });
});
