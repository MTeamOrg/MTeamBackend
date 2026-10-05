import { Router, type RequestHandler } from "express";
import type { AccessAttemptController } from "../controller/access-attempt-controller.js";
import { authorize } from "../middleware/authorization-middleware.js";
import type { UserAccessRepositoryPort } from "../repository/user-repository.js";
import type { TokenVerifier } from "../service/token-service.js";
import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";

function createAccessAuthentication(tokenVerifier: TokenVerifier, users: UserAccessRepositoryPort): RequestHandler {
  return async (request, _response, next) => {
    const token = request.get("Authorization")?.match(/^Bearer ([^\s,]+)$/i)?.[1];
    const identity = token ? tokenVerifier.verify(token) : null;
    if (!identity) throw new ApplicationError(401, ERROR_CODE.UNAUTHORIZED, "Se requiere una autenticación válida");
    const user = await users.findAccessControlUserById(identity.sub);
    if (!user) throw new ApplicationError(401, ERROR_CODE.UNAUTHORIZED, "Se requiere una autenticación válida");
    request.authenticatedUser = { id: user.id, role: user.role, isPasswordChangeRequired: user.isPasswordChangeRequired };
    next();
  };
}

export function createAccessAttemptRouter(
  controller: AccessAttemptController, authenticate: RequestHandler,
  requireCompletedPasswordChange: RequestHandler,
  tokenVerifier: TokenVerifier, users: UserAccessRepositoryPort,
): Router {
  const router = Router();
  const authenticateAccess = createAccessAuthentication(tokenVerifier, users);
  router.post("/access-attempts", authenticateAccess, requireCompletedPasswordChange, authorize("MEMBER", "TRAINER"), controller.create);
  router.get("/access-attempts", authenticate, requireCompletedPasswordChange, authorize("ADMIN"), controller.list);
  return router;
}
