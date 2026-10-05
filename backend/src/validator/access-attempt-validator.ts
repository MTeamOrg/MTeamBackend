import { z } from "zod";

export const createAccessAttemptSchema = z.strictObject({
  qrToken: z.string().min(1),
});

export const listAccessAttemptsSchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  userId: z.uuid().optional(),
  search: z.string().trim().max(100).optional(),
  branchId: z.uuid().optional(),
  role: z.enum(["MEMBER", "TRAINER", "ADMIN"]).optional(),
  result: z.enum(["ALLOWED", "DENIED"]).optional(),
});

export type ListAccessAttemptsQuery = z.infer<typeof listAccessAttemptsSchema>;
