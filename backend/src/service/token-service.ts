import jwt from "jsonwebtoken";

import type { UserRole } from "../generated/prisma/client.js";

export interface TokenIssuer {
  readonly expiresIn: number;
  sign(user: { id: string; role: UserRole }): string;
}

export class TokenService implements TokenIssuer {
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
}
