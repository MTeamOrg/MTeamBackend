import jwt from "jsonwebtoken";
import { z } from "zod";

import type { UserRole } from "../generated/prisma/client.js";

export interface TokenIssuer {
  readonly expiresIn: number;
  sign(user: { id: string; role: UserRole; sessionVersion?: number }): string;
}

export interface TokenVerifier {
  verify(token: string): { sub: string; sessionVersion: number } | null;
}

const accessTokenSchema = z.object({
  sub: z.uuid(),
  role: z.enum(["MEMBER", "TRAINER", "ADMIN"]),
  sessionVersion: z.number().int().nonnegative().default(0),
  exp: z.number().int().positive(),
});

export class TokenService implements TokenIssuer, TokenVerifier {
  constructor(
    private readonly secret: string,
    readonly expiresIn: number,
  ) {
    if (!secret.trim() || !Number.isSafeInteger(expiresIn) || expiresIn <= 0) {
      throw new Error("Invalid JWT configuration");
    }
  }

  sign(user: { id: string; role: UserRole; sessionVersion?: number }): string {
    return jwt.sign({
      sub: user.id,
      role: user.role,
      sessionVersion: user.sessionVersion ?? 0,
    }, this.secret, {
      algorithm: "HS256",
      expiresIn: this.expiresIn,
      noTimestamp: true,
    });
  }

  verify(token: string): { sub: string; sessionVersion: number } | null {
    try {
      const payload = jwt.verify(token, this.secret, { algorithms: ["HS256"] });
      const validation = accessTokenSchema.safeParse(payload);
      return validation.success
        ? { sub: validation.data.sub, sessionVersion: validation.data.sessionVersion }
        : null;
    } catch (error: unknown) {
      if (error instanceof jwt.JsonWebTokenError) return null;
      throw error;
    }
  }
}
