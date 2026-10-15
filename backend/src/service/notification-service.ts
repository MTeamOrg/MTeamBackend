import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import {
  type NotificationRepositoryPort,
} from "../repository/notification-repository.js";
import type { NotificationListQuery } from "../validator/notification-validator.js";

export class NotificationService {
  constructor(
    private readonly repository: NotificationRepositoryPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async listOwn(userId: string, query: NotificationListQuery) {
    await this.refreshMembershipNotice(userId);
    return this.repository.listOwn(userId, query);
  }

  async getOwn(id: string, userId: string) {
    const notification = await this.repository.findOwn(id, userId);
    if (!notification) throw new ApplicationError(404, ERROR_CODE.NOT_FOUND, "La notificación no existe");
    return notification;
  }

  async markOwnAsRead(id: string, userId: string): Promise<void> {
    const notification = await this.repository.findOwn(id, userId);
    if (!notification) throw new ApplicationError(404, ERROR_CODE.NOT_FOUND, "La notificación no existe");
    await this.repository.markOwnAsRead(id, userId);
  }

  markAllOwnAsRead(userId: string): Promise<void> {
    return this.repository.markAllOwnAsRead(userId);
  }

  /**
   * Fee notices are derived from the payment history when the member opens the inbox. A failure here
   * must not stop the member from reading the notifications that already exist.
   */
  private async refreshMembershipNotice(userId: string): Promise<void> {
    try {
      await this.repository.ensureMembershipStatusNotification(userId, this.now());
    } catch (error: unknown) {
      console.error("No se pudo actualizar el aviso de cuota", error);
    }
  }
}
