import type { RequestHandler } from "express";

import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";

export const notFoundMiddleware: RequestHandler = (request, _response, next) => {
  next(
    new ApplicationError(
      404,
      ERROR_CODE.NOT_FOUND,
      "El recurso solicitado no existe",
      { method: request.method, path: request.originalUrl },
    ),
  );
};
