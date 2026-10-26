import type { ErrorRequestHandler } from "express";

import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";

export const errorMiddleware: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next,
) => {
  if (error instanceof ApplicationError) {
    response.status(error.statusCode).json({
      code: error.code,
      message: error.message,
      details: error.details,
    });
    return;
  }

  console.error(error);
  response.status(500).json({
    code: ERROR_CODE.INTERNAL_ERROR,
    message: "Ocurrió un error interno",
    details: null,
  });
};
