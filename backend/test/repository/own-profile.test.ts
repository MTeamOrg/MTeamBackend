import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { UserRepository } from "../../src/repository/user-repository.js";

function setup() {
  const persisted = { id: "trainer-id", trainerProfile: { specialty: "Funcional", description: "Personalizado" } };
  const transaction = {
    user: { update: jest.fn().mockResolvedValue(persisted) },
    userAuditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const database = { $transaction: jest.fn(async callback => callback(transaction)) };
  return { repository: new UserRepository(database as unknown as PrismaClient), transaction, persisted };
}

test.each([{ specialty: "Funcional", description: "Personalizado" }, { specialty: "Funcional" }, { description: "Personalizado" }])("updates the existing professional relation and returns persistence: %j", async input => {
  const { repository, transaction, persisted } = setup();
  await expect(repository.updateOwnProfile("trainer-id", "TRAINER", input)).resolves.toBe(persisted);
  expect(transaction.user.update).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: "trainer-id" }, data: { trainerProfile: { update: input } },
  }));
  expect(transaction.userAuditLog.create).toHaveBeenCalledWith({ data: { userId: "trainer-id", performedById: "trainer-id", action: "UPDATED" } });
});

test.each(["MEMBER", "ADMIN"] as const)("never writes trainer relation for %s", async role => {
  const { repository, transaction } = setup();
  await repository.updateOwnProfile("user-id", role, { specialty: "Ignored" });
  expect(transaction.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: {} }));
});
