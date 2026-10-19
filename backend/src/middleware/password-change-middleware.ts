import type { RequestHandler } from "express";

import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";

export const requirePasswordChangeCompleted: RequestHandler = (
  request,
  _response,
  next,
) => {
  if (!request.authenticatedUser) {
    throw new ApplicationError(
      401,
      ERROR_CODE.UNAUTHORIZED,
      "Se requiere una autenticación válida",
    );
  }
  if (request.authenticatedUser.isPasswordChangeRequired) {
    throw new ApplicationError(
      403,
      ERROR_CODE.PASSWORD_CHANGE_REQUIRED,
      "Debe cambiar la contraseña temporal antes de continuar",
    );
  }
  next();
};
