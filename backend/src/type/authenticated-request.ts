import type { UserRole } from "../generated/prisma/client.js";

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  isPasswordChangeRequired: boolean;
}

declare module "express-serve-static-core" {
  interface Request {
    authenticatedUser?: AuthenticatedUser;
  }
}
