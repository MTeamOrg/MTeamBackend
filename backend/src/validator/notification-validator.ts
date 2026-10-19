import { z } from "zod";

export const notificationListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  isRead: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
});

export const notificationIdParamsSchema = z.strictObject({ notificationId: z.uuid() });

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
