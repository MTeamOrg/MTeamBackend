import type {
  NotificationType,
  Prisma,
  PrismaClient,
} from "../generated/prisma/client.js";
import { calculateMembershipStatus } from "../model/membership-status.js";
import {
  eventCancelledNotice,
  membershipExpiredNotice,
  membershipExpiringNotice,
  membershipPriceIncreasedNotice,
} from "../model/notification-message.js";
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
  /** Notifications matching the requested filter. */
  total: number;
  /** Every unread notification of the user, whatever the filter or page. */
  unreadCount: number;
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

/**
 * The audience fan-outs for price increases and event cancellations use INSERT ... SELECT, so Node
 * does not load and rebuild thousands of recipients. Keep a bounded transaction allowance because the
 * notification rows still commit atomically with their business change; the timeout is headroom, not
 * the only mitigation for a large audience.
 */
export const AUDIENCE_TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 60_000 } as const;

/**
 * Inserts the notices that do not exist yet. `dedupeKey` identifies one real domain event
 * (never a state), so replays of the same event are ignored and a new event is never lost.
 */
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

/**
 * Inserts a price increase notice for each active member without loading the audience into the API
 * process. This runs in the same transaction as the price write, so price and notices commit or
 * roll back together while Postgres performs the bulk fan-out set-wise.
 */
export async function createMembershipPriceIncreaseNotifications(
  transaction: Prisma.TransactionClient,
  price: { id: string; amount: string; effectiveFrom: Date },
): Promise<void> {
  const notice = membershipPriceIncreasedNotice(price);
  await transaction.$executeRaw`
    INSERT INTO "notification" ("id", "user_id", "dedupe_key", "title", "message", "type", "created_at")
    SELECT
      gen_random_uuid(),
      member."id",
      'membership-price-changed:' || CAST(${price.id} AS text) || ':' || CAST(member."id" AS text),
      ${notice.title},
      ${notice.message},
      'MEMBERSHIP_PRICE_CHANGED',
      CURRENT_TIMESTAMP
    FROM "user" AS member
    WHERE member."role" = 'MEMBER'
      AND member."status" = 'ACTIVE'
    ON CONFLICT ("dedupe_key") DO NOTHING
  `;
}

/** Fan-out a published event cancellation to active members and trainers inside its state transaction. */
export async function createEventCancellationNotifications(
  transaction: Prisma.TransactionClient,
  event: { id: string; title: string; startsAt: Date },
): Promise<void> {
  const notice = eventCancelledNotice(event);
  await transaction.$executeRaw`
    INSERT INTO "notification" ("id", "user_id", "dedupe_key", "title", "message", "type", "created_at")
    SELECT
      gen_random_uuid(),
      recipient."id",
      'event-cancelled:' || CAST(${event.id} AS text) || ':' || CAST(recipient."id" AS text),
      ${notice.title},
      ${notice.message},
      'EVENT_CANCELLED',
      CURRENT_TIMESTAMP
    FROM "user" AS recipient
    WHERE recipient."role" IN ('MEMBER', 'TRAINER')
      AND recipient."status" = 'ACTIVE'
    ON CONFLICT ("dedupe_key") DO NOTHING
  `;
}

export class NotificationRepository implements NotificationRepositoryPort {
  constructor(private readonly database: PrismaClient) {}

  async listOwn(userId: string, query: NotificationListQuery): Promise<NotificationList> {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.isRead === undefined ? {} : { readAt: query.isRead ? { not: null } : null }),
    };
    const [total, unreadCount, items] = await this.database.$transaction([
      this.database.notification.count({ where }),
      this.database.notification.count({ where: { userId, readAt: null } }),
      this.database.notification.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: notificationSelect,
      }),
    ]);
    return { items, page: query.page, limit: query.limit, total, unreadCount };
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

  /**
   * CUO-04/CUO-05: a member whose latest accredited payment expires within five days, or has
   * already expired (or never paid), gets one notice per expiration date. Safe to call repeatedly
   * and concurrently: the unique `dedupeKey` turns every repetition into a no-op.
   */
  async ensureMembershipStatusNotification(userId: string, now: Date): Promise<void> {
    const user = await this.database.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user || user.role !== "MEMBER") return;

    const payment = await this.database.payment.findFirst({
      where: { memberId: userId, status: "ACCREDITED", accreditedAt: { lte: now } },
      orderBy: [{ expiresAt: "desc" }, { accreditedAt: "desc" }, { id: "desc" }],
      select: { expiresAt: true },
    });
    const expiresAt = payment?.expiresAt ?? null;
    const status = calculateMembershipStatus(expiresAt, now);

    if (status === "EXPIRED") {
      await createNotifications(this.database, [{
        userId,
        ...membershipExpiredNotice(expiresAt),
        type: "MEMBERSHIP_EXPIRED",
        dedupeKey: `membership-expired:${userId}:${expiresAt?.toISOString() ?? "none"}`,
      }]);
    } else if (status === "EXPIRING_SOON" && expiresAt) {
      await createNotifications(this.database, [{
        userId,
        ...membershipExpiringNotice(expiresAt),
        type: "MEMBERSHIP_EXPIRING",
        dedupeKey: `membership-expiring:${userId}:${expiresAt.toISOString()}`,
      }]);
    }
  }
}
