import { z } from "zod";

export const adminUserListQuerySchema = z.strictObject({
  search: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(["MEMBER", "TRAINER", "ADMIN"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const userIdParamsSchema = z.strictObject({
  userId: z.uuid(),
});

export const updateUserStatusSchema = z.strictObject({
  status: z.enum(["ACTIVE", "INACTIVE"]),
  reason: z.string().trim().optional(),
});

export type AdminUserListQueryInput = z.infer<typeof adminUserListQuerySchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
