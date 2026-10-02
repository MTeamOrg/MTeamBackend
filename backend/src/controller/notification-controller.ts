import type { RequestHandler } from "express";

import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import type { NotificationService } from "../service/notification-service.js";
import { notificationIdParamsSchema, notificationListQuerySchema } from "../validator/notification-validator.js";

function serializeNotification(notification: Awaited<ReturnType<NotificationService["getOwn"]>>) {
  return {
    ...notification,
    createdAt: notification.createdAt.toISOString(),
    readAt: notification.readAt?.toISOString() ?? null,
  };
}

export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  list: RequestHandler = async (request, response) => {
    const validation = notificationListQuerySchema.safeParse(request.query);
    if (!validation.success) throw this.invalid(validation.error.flatten());
    const result = await this.service.listOwn(request.authenticatedUser!.id, validation.data);
    response.status(200).json({ ...result, items: result.items.map(serializeNotification) });
  };

  get: RequestHandler = async (request, response) => {
    const params = notificationIdParamsSchema.safeParse(request.params);
    if (!params.success) throw this.invalid(params.error.flatten());
    response.status(200).json(serializeNotification(await this.service.getOwn(params.data.notificationId, request.authenticatedUser!.id)));
  };

  markRead: RequestHandler = async (request, response) => {
    const params = notificationIdParamsSchema.safeParse(request.params);
    if (!params.success) throw this.invalid(params.error.flatten());
    await this.service.markOwnAsRead(params.data.notificationId, request.authenticatedUser!.id);
    response.status(204).send();
  };

  markAllRead: RequestHandler = async (request, response) => {
    await this.service.markAllOwnAsRead(request.authenticatedUser!.id);
    response.status(204).send();
  };

  private invalid(details: unknown) {
    return new ApplicationError(400, ERROR_CODE.VALIDATION_ERROR, "Los datos de la notificación no son válidos", details);
  }
}
