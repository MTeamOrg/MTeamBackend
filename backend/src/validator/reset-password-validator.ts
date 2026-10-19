import { z } from "zod";

export const passwordResetParamsSchema = z.strictObject({
  userId: z.uuid(),
});

export const resetPasswordBodySchema = z.strictObject({});
