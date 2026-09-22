import type { RequestHandler } from "express";

import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import type {
  AdminUserManagementService,
  TemporaryPasswordResetService,
} from "../service/admin-user-service.js";
import {
  passwordResetParamsSchema,
  resetPasswordSchema,
} from "../validator/reset-password-validator.js";
import {
  adminUserListQuerySchema,
  updateUserStatusSchema,
  userIdParamsSchema,
} from "../validator/admin-user-validator.js";

export class AdminUserController {
  constructor(
    private readonly userService: TemporaryPasswordResetService &
      AdminUserManagementService,
  ) {}

  listUsers: RequestHandler = async (request, response) => {
    const validation = adminUserListQuerySchema.safeParse(request.query);
    if (!validation.success) {
      throw new ApplicationError(
        400,
        ERROR_CODE.VALIDATION_ERROR,
        "Los filtros de usuarios no son válidos",
        validation.error.flatten(),
      );
    }
    response.status(200).json(await this.userService.listUsers(validation.data));
  };

  updateUserStatus: RequestHandler = async (request, response) => {
    const paramsValidation = userIdParamsSchema.safeParse(request.params);
    const bodyValidation = updateUserStatusSchema.safeParse(request.body);
    if (!paramsValidation.success || !bodyValidation.success) {
      throw new ApplicationError(
        400,
        ERROR_CODE.VALIDATION_ERROR,
        "Los datos para actualizar el estado no son válidos",
        {
          params: paramsValidation.success ? null : paramsValidation.error.flatten(),
          body: bodyValidation.success ? null : bodyValidation.error.flatten(),
        },
      );
    }
    const user = await this.userService.updateUserStatus(
      paramsValidation.data.userId,
      request.authenticatedUser!.id,
      bodyValidation.data,
    );
    response.status(200).json(user);
  };

  listUserAuditLogs: RequestHandler = async (request, response) => {
    const paramsValidation = userIdParamsSchema.safeParse(request.params);
    const queryValidation = adminUserListQuerySchema
      .pick({ page: true, limit: true })
      .safeParse(request.query);
    if (!paramsValidation.success || !queryValidation.success) {
      throw new ApplicationError(
        400,
        ERROR_CODE.VALIDATION_ERROR,
        "Los filtros del historial no son válidos",
        {
          params: paramsValidation.success ? null : paramsValidation.error.flatten(),
          query: queryValidation.success ? null : queryValidation.error.flatten(),
        },
      );
    }
    const result = await this.userService.listUserAuditLogs(
      paramsValidation.data.userId,
      queryValidation.data.page,
      queryValidation.data.limit,
    );
    response.status(200).json({
      ...result,
      items: result.items.map((item) => ({
        ...item,
        occurredAt: item.occurredAt.toISOString(),
      })),
    });
  };

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
