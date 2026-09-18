import jwt from "jsonwebtoken";
import { z } from "zod";

import type { UserRole } from "../generated/prisma/client.js";

export interface TokenIssuer {
  readonly expiresIn: number;
  sign(user: { id: string; role: UserRole }): string;
}

export interface TokenVerifier {
  verify(token: string): { sub: string } | null;
}

const accessTokenSchema = z.object({
  sub: z.uuid(),
  role: z.enum(["MEMBER", "TRAINER", "ADMIN"]),
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

  sign(user: { id: string; role: UserRole }): string {
    return jwt.sign({ sub: user.id, role: user.role }, this.secret, {
      algorithm: "HS256",
      expiresIn: this.expiresIn,
      noTimestamp: true,
    });
  }

  verify(token: string): { sub: string } | null {
    try {
      const payload = jwt.verify(token, this.secret, { algorithms: ["HS256"] });
      const validation = accessTokenSchema.safeParse(payload);
      return validation.success ? { sub: validation.data.sub } : null;
    } catch (error: unknown) {
      if (error instanceof jwt.JsonWebTokenError) return null;
      throw error;
    }
  }
}
