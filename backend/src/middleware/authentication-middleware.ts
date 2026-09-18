import type { RequestHandler } from "express";

import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import type { UserAccessRepositoryPort } from "../repository/user-repository.js";
import type { TokenVerifier } from "../service/token-service.js";
import type { AuthenticatedUser } from "../type/authenticated-request.js";

export function createAuthenticationMiddleware(
  tokenVerifier: TokenVerifier,
  userRepository: UserAccessRepositoryPort,
): RequestHandler {
  return async (request, _response, next) => {
    delete request.authenticatedUser;
    const authorization = request.get("Authorization");
    const token = authorization?.match(/^Bearer ([^\s,]+)$/i)?.[1];
    const identity = token ? tokenVerifier.verify(token) : null;

    if (!identity) {
      throw new ApplicationError(401, ERROR_CODE.UNAUTHORIZED, "Se requiere una autenticación válida");
    }

    const user = await userRepository.findAccessControlUserById(identity.sub);
    if (!user) {
      throw new ApplicationError(401, ERROR_CODE.UNAUTHORIZED, "Se requiere una autenticación válida");
    }
    if (user.status !== "ACTIVE") {
      throw new ApplicationError(403, ERROR_CODE.ACCOUNT_INACTIVE, "La cuenta se encuentra inactiva");
    }

    request.authenticatedUser = { id: user.id, role: user.role } satisfies AuthenticatedUser;
    next();
  };
}
