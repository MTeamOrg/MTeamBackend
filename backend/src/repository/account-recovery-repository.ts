import { createHash } from "node:crypto";
import type { PrismaClient } from "../generated/prisma/client.js";

export const fingerprintPassword = (hash: string): string => createHash("sha256").update(hash).digest("hex");
export interface RecoveryToken {
  tokenHash: string;
  userId: string;
  passwordFingerprint: string;
  expiresAt: Date;
}
export interface AccountRecoveryRepositoryPort {
  findUser(email: string): Promise<{ id: string; passwordHash: string } | null>;
  findPassword(userId: string): Promise<string | null>;
  createToken(token: RecoveryToken): Promise<void>;
  deleteToken(tokenHash: string): Promise<void>;
  findToken(tokenHash: string): Promise<RecoveryToken | null>;
  consumeToken(token: RecoveryToken, passwordHash: string, now: Date): Promise<boolean>;
}

export class AccountRecoveryRepository implements AccountRecoveryRepositoryPort {
  constructor(private readonly database: PrismaClient) {}
  findUser(email: string) {
    return this.database.user.findFirst({ where: { email, status: "ACTIVE" }, select: { id: true, passwordHash: true } });
  }
  async findPassword(userId: string): Promise<string | null> {
    const user = await this.database.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
    return user?.passwordHash ?? null;
  }
  async createToken(token: RecoveryToken): Promise<void> {
    await this.database.passwordRecoveryToken.create({ data: token });
  }
  async deleteToken(tokenHash: string): Promise<void> {
    await this.database.passwordRecoveryToken.deleteMany({ where: { tokenHash } });
  }
  findToken(tokenHash: string) {
    return this.database.passwordRecoveryToken.findUnique({ where: { tokenHash } });
  }
  async consumeToken(token: RecoveryToken, passwordHash: string, now: Date): Promise<boolean> {
    return this.database.$transaction(async (transaction) => {
      // Serialize resets for this user, including different outstanding links.
      await transaction.$queryRaw`SELECT id FROM "user" WHERE id = ${token.userId}::uuid FOR UPDATE`;
      const user = await transaction.user.findUnique({ where: { id: token.userId }, select: { passwordHash: true, status: true } });
      if (!user || user.status !== "ACTIVE" || fingerprintPassword(user.passwordHash) !== token.passwordFingerprint) return false;
      const effectiveNow = new Date(Math.max(now.getTime(), Date.now()));
      const result = await transaction.passwordRecoveryToken.deleteMany({
        where: { tokenHash: token.tokenHash, userId: token.userId, expiresAt: { gt: effectiveNow } },
      });
      if (result.count !== 1) return false;
      await transaction.user.update({ where: { id: token.userId }, data: {
        passwordHash,
        isPasswordChangeRequired: false,
        sessionVersion: { increment: 1 },
      } });
      await transaction.passwordRecoveryToken.deleteMany({ where: { userId: token.userId } });
      await transaction.userAuditLog.create({ data: {
        userId: token.userId, performedById: token.userId, action: "UPDATED", reason: "PASSWORD_RECOVERED",
      } });
      return true;
    });
  }
}
