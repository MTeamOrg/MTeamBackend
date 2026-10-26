import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { AdminDashboardRepository } from "../../src/repository/admin-dashboard-repository.js";

describe("admin dashboard repository", () => {
  test("counts dashboard metrics and converts the raw initial-period count", async () => {
    const userCount = jest.fn()
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(3);
    const certificateCount = jest.fn().mockResolvedValueOnce(4).mockResolvedValueOnce(5);
    const queryRaw = jest.fn().mockResolvedValue([{ count: 6n }]);
    const database = {
      user: { count: userCount },
      medicalCertificate: { count: certificateCount },
      $queryRaw: queryRaw,
    } as unknown as PrismaClient;
    const now = new Date("2026-10-22T12:00:00.000Z");

    await expect(new AdminDashboardRepository(database).getMetrics(now)).resolves.toEqual({
      activeMembers: 10,
      inactiveMembers: 2,
      currentMemberships: 7,
      expiringMemberships: 1,
      expiredMemberships: 3,
      pendingMedicalCertificates: 4,
      rejectedMedicalCertificates: 5,
      initialPeriodMembers: 6,
    });
    expect(userCount).toHaveBeenCalledTimes(5);
    expect(certificateCount).toHaveBeenCalledTimes(2);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  test("returns zero when the initial-period aggregate has no row", async () => {
    const database = {
      user: { count: jest.fn().mockResolvedValue(0) },
      medicalCertificate: { count: jest.fn().mockResolvedValue(0) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    } as unknown as PrismaClient;
    await expect(new AdminDashboardRepository(database).getMetrics(new Date()))
      .resolves.toMatchObject({ initialPeriodMembers: 0 });
  });
});
