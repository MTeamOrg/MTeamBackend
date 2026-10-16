import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { AccountRecoveryRepository, fingerprintPassword } from "../../src/repository/account-recovery-repository.js";

function setup() {
  const transaction = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    user: { findUnique: jest.fn().mockResolvedValue({ passwordHash: "old-hash", status: "ACTIVE" }), update: jest.fn().mockResolvedValue({}) },
    userAuditLog: { create: jest.fn().mockResolvedValue({}) },
    passwordRecoveryToken: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const database = { $transaction: jest.fn(async callback => callback(transaction)) };
  const repository = new AccountRecoveryRepository(database as unknown as PrismaClient);
  const token = { tokenHash: "hash", userId: "user-id", passwordFingerprint: fingerprintPassword("old-hash"), expiresAt: new Date(Date.now() + 60_000) };
  return { repository, database, transaction, token };
}
test("locks user, consumes unexpired token, updates password, invalidates other links and audits in one transaction", async () => {
  const { repository, transaction, database, token } = setup();
  const now = new Date();
  await expect(repository.consumeToken(token, "new-hash", now)).resolves.toBe(true);
  expect(database.$transaction).toHaveBeenCalledTimes(1);
  expect(transaction.$queryRaw).toHaveBeenCalled();
  expect(transaction.passwordRecoveryToken.deleteMany).toHaveBeenNthCalledWith(1, { where: { tokenHash: "hash", userId: "user-id", expiresAt: { gt: expect.any(Date) } } });
  expect(transaction.user.update).toHaveBeenCalledWith({ where: { id: "user-id" }, data: {
    passwordHash: "new-hash",
    isPasswordChangeRequired: false,
    sessionVersion: { increment: 1 },
  } });
  expect(transaction.passwordRecoveryToken.deleteMany).toHaveBeenNthCalledWith(2, { where: { userId: "user-id" } });
  expect(transaction.userAuditLog.create).toHaveBeenCalledWith({ data: { userId: "user-id", performedById: "user-id", action: "UPDATED", reason: "PASSWORD_RECOVERED" } });
  expect(transaction.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(transaction.user.update.mock.invocationCallOrder[0]!);
});
test.each([null, { passwordHash: "changed-hash", status: "ACTIVE" }, { passwordHash: "old-hash", status: "INACTIVE" }])("rejects changed/deleted/inactive user under lock: %j", async user => {
  const { repository, transaction, token } = setup();
  transaction.user.findUnique.mockResolvedValue(user);
  await expect(repository.consumeToken(token, "new-hash", new Date())).resolves.toBe(false);
  expect(transaction.user.update).not.toHaveBeenCalled();
});
test("missing, already consumed or expired token cannot update password", async () => {
  const { repository, transaction, token } = setup();
  transaction.passwordRecoveryToken.deleteMany.mockResolvedValue({ count: 0 });
  await expect(repository.consumeToken(token, "new-hash", new Date())).resolves.toBe(false);
  expect(transaction.user.update).not.toHaveBeenCalled();
});
