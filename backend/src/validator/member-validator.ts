import { z } from "zod";

import { adminUserListQuerySchema } from "./admin-user-validator.js";

export const memberListQuerySchema = adminUserListQuerySchema
  .pick({ search: true, page: true, limit: true })
  .extend({ membershipStatus: z.enum(["CURRENT", "EXPIRING_SOON", "EXPIRED"]).optional() });

export type MemberListQueryInput = z.infer<typeof memberListQuerySchema>;
