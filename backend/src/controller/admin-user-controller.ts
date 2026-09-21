import type { RequestHandler } from "express";

import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import type { TemporaryPasswordResetService } from "../service/admin-user-service.js";
import {
  passwordResetParamsSchema,
  resetPasswordSchema,
} from "../validator/reset-password-validator.js";

export class AdminUserController {
  constructor(private readonly userService: TemporaryPasswordResetService) {}

  resetTemporaryPassword: RequestHandler = async (request, response) => {
    const paramsValidation = passwordResetParamsSchema.safeParse(request.params);
    const bodyValidation = resetPasswordSchema.safeParse(request.body);
    if (!paramsValidation.success || !bodyValidation.success) {
      throw new ApplicationError(
        400,
        ERROR_CODE.VALIDATION_ERROR,
        "Los datos para restablecer la contraseña no son válidos",
        {
          params: paramsValidation.success
            ? null
            : paramsValidation.error.flatten(),
          body: bodyValidation.success ? null : bodyValidation.error.flatten(),
        },
      );
    }

    await this.userService.resetTemporaryPassword(
      paramsValidation.data.userId,
      request.authenticatedUser!.id,
      bodyValidation.data,
    );
    response.status(204).send();
  };
}
