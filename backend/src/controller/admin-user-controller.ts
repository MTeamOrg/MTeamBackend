import type { RequestHandler } from "express";

import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import type { AdminUserDetail } from "../repository/user-repository.js";
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
  createAdminUserSchema,
  updateAdminUserSchema,
  updateUserStatusSchema,
  userIdParamsSchema,
} from "../validator/admin-user-validator.js";

function serializeAdminUser(user: AdminUserDetail) {
  return {
    ...user,
    birthDate: user.birthDate.toISOString().slice(0, 10),
    createdAt: user.createdAt.toISOString(),
    membership: user.membership
      ? { ...user.membership, expiresAt: user.membership.expiresAt.toISOString() }
      : null,
    payments: user.payments.map((payment) => ({
      ...payment,
      createdAt: payment.createdAt.toISOString(),
      accreditedAt: payment.accreditedAt.toISOString(),
      expiresAt: payment.expiresAt.toISOString(),
    })),
    medicalCertificates: user.medicalCertificates.map((certificate) => ({
      ...certificate,
      uploadedAt: certificate.uploadedAt.toISOString(),
      reviewedAt: certificate.reviewedAt?.toISOString() ?? null,
    })),
    classes: user.classes.map((scheduledClass) => ({
      ...scheduledClass,
      startsAt: scheduledClass.startsAt.toISOString(),
    })),
  };
}

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

  getUser: RequestHandler = async (request, response) => {
    const paramsValidation = userIdParamsSchema.safeParse(request.params);
    if (!paramsValidation.success) {
      throw new ApplicationError(
        400,
        ERROR_CODE.VALIDATION_ERROR,
        "El identificador de usuario no es válido",
        paramsValidation.error.flatten(),
      );
    }
    const user = await this.userService.getUser(paramsValidation.data.userId);
    response.status(200).json(serializeAdminUser(user));
  };

  createUser: RequestHandler = async (request, response) => {
    const validation = createAdminUserSchema.safeParse(request.body);
    if (!validation.success) {
      throw new ApplicationError(
        400,
        ERROR_CODE.VALIDATION_ERROR,
        "Los datos del usuario no son válidos",
        validation.error.flatten(),
      );
    }
    const user = await this.userService.createUser(
      request.authenticatedUser!.id,
      validation.data,
    );
    response.status(201).json(serializeAdminUser(user));
  };

  updateUser: RequestHandler = async (request, response) => {
    const paramsValidation = userIdParamsSchema.safeParse(request.params);
    const bodyValidation = updateAdminUserSchema.safeParse(request.body);
    if (!paramsValidation.success || !bodyValidation.success) {
      throw new ApplicationError(
        400,
        ERROR_CODE.VALIDATION_ERROR,
        "Los datos para modificar el usuario no son válidos",
        {
          params: paramsValidation.success ? null : paramsValidation.error.flatten(),
          body: bodyValidation.success ? null : bodyValidation.error.flatten(),
        },
      );
    }
    const user = await this.userService.updateUser(
      paramsValidation.data.userId,
      request.authenticatedUser!.id,
      bodyValidation.data,
    );
    response.status(200).json(serializeAdminUser(user));
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
