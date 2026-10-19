import type { RequestHandler } from "express";

import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import type { UserRole } from "../generated/prisma/client.js";
import type { AuthenticatedUser } from "../type/authenticated-request.js";

export function authorize(...allowedRoles: UserRole[]): RequestHandler {
  return (request, _response, next) => {
    const user: AuthenticatedUser | undefined = request.authenticatedUser;
    if (!user) {
      throw new ApplicationError(401, ERROR_CODE.UNAUTHORIZED, "Se requiere una autenticación válida");
    }
    if (!allowedRoles.includes(user.role)) {
      throw new ApplicationError(403, ERROR_CODE.FORBIDDEN, "No tiene permisos para realizar esta operación");
    }
    next();
  };
}
