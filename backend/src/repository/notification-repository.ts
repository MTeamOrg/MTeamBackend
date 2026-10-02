import type {
  Notification,
  NotificationType,
  Prisma,
  PrismaClient,
  UserRole,
} from "../generated/prisma/client.js";
import type { NotificationListQuery } from "../validator/notification-validator.js";

const notificationSelect = {
  id: true,
  userId: true,
  title: true,
  message: true,
  type: true,
  createdAt: true,
  readAt: true,
} as const satisfies Prisma.NotificationSelect;

export type NotificationRecord = Prisma.NotificationGetPayload<{
  select: typeof notificationSelect;
}>;

export interface NotificationList {
  items: NotificationRecord[];
  page: number;
  limit: number;
  total: number;
}

export interface NotificationRepositoryPort {
  listOwn(userId: string, query: NotificationListQuery): Promise<NotificationList>;
  findOwn(id: string, userId: string): Promise<NotificationRecord | null>;
  markOwnAsRead(id: string, userId: string): Promise<void>;
  markAllOwnAsRead(userId: string): Promise<void>;
  ensureMembershipStatusNotification(userId: string, now: Date): Promise<void>;
}

export interface NotificationRecipient {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  dedupeKey: string;
}

export async function createNotifications(
  database: Pick<PrismaClient, "notification"> | Prisma.TransactionClient,
  recipients: NotificationRecipient[],
): Promise<void> {
  if (!recipients.length) return;
  await database.notification.createMany({
    data: recipients,
    skipDuplicates: true,
  });
}

export class NotificationRepository implements NotificationRepositoryPort {
  constructor(private readonly database: PrismaClient) {}

  async listOwn(userId: string, query: NotificationListQuery): Promise<NotificationList> {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.isRead === undefined ? {} : { readAt: query.isRead ? { not: null } : null }),
    };
    const [total, items] = await this.database.$transaction([
      this.database.notification.count({ where }),
      this.database.notification.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: notificationSelect,
      }),
    ]);
    return { items, page: query.page, limit: query.limit, total };
  }

  findOwn(id: string, userId: string): Promise<NotificationRecord | null> {
    return this.database.notification.findFirst({
      where: { id, userId },
      select: notificationSelect,
    });
  }

  async markOwnAsRead(id: string, userId: string): Promise<void> {
    await this.database.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async markAllOwnAsRead(userId: string): Promise<void> {
    await this.database.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async ensureMembershipStatusNotification(userId: string, now: Date): Promise<void> {
    const user = await this.database.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user || user.role !== "MEMBER") return;

    const payment = await this.database.payment.findFirst({
      where: { memberId: userId, status: "ACCREDITED", accreditedAt: { lte: now } },
      orderBy: [{ expiresAt: "desc" }, { accreditedAt: "desc" }, { id: "desc" }],
      select: { expiresAt: true },
    });
    const expiresAt = payment?.expiresAt ?? null;
    const fiveDaysFromNow = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

    let notification: NotificationRecipient | null = null;
    if (!expiresAt || expiresAt <= now) {
      const dateKey = expiresAt?.toISOString() ?? "none";
      notification = {
        userId,
        title: "Cuota vencida",
        message: "Tu cuota se encuentra vencida. Registrá un nuevo pago para mantener tu acceso.",
        type: "MEMBERSHIP_EXPIRED",
        dedupeKey: `membership-expired:${userId}:${dateKey}`,
      };
    } else if (expiresAt <= fiveDaysFromNow) {
      notification = {
        userId,
        title: "Cuota próxima a vencer",
        message: `Tu cuota vence el ${expiresAt.toLocaleDateString("es-AR")}.`,
        type: "MEMBERSHIP_EXPIRING",
        dedupeKey: `membership-expiring:${userId}:${expiresAt.toISOString()}`,
      };
    }
    if (notification) await createNotifications(this.database, [notification]);
  }
}

export function audienceRoles(audience: "ALL" | "MEMBERS" | "TRAINERS"): UserRole[] {
  if (audience === "MEMBERS") return ["MEMBER"];
  if (audience === "TRAINERS") return ["TRAINER"];
  return ["MEMBER", "TRAINER"];
}
