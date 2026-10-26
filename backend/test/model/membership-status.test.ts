import {
  calculateDaysRemaining,
  calculateMembershipStatus,
} from "../../src/model/membership-status.js";

const now = new Date("2026-09-25T15:00:00.000Z");

describe("calculated membership state", () => {
  test.each([
    [null, "EXPIRED", 0],
    [new Date("2026-09-25T15:00:00.000Z"), "EXPIRED", 0],
    [new Date("2026-09-30T15:00:00.000Z"), "EXPIRING_SOON", 5],
    [new Date("2026-09-30T15:00:00.001Z"), "CURRENT", 6],
    [new Date("2026-10-25T15:00:00.000Z"), "CURRENT", 30],
  ] as const)("classifies %s as %s", (expiresAt, status, daysRemaining) => {
    expect(calculateMembershipStatus(expiresAt, now)).toBe(status);
    expect(calculateDaysRemaining(expiresAt, now)).toBe(daysRemaining);
  });

  test("rounds a positive partial day up and never returns a negative value", () => {
    expect(calculateDaysRemaining(new Date(now.getTime() + 1), now)).toBe(1);
    expect(calculateDaysRemaining(new Date(now.getTime() - 1), now)).toBe(0);
  });
});
