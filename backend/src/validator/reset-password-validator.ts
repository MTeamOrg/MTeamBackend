import { z } from "zod";

export const passwordResetParamsSchema = z.strictObject({
  userId: z.uuid(),
});

export const resetPasswordSchema = z.strictObject({
  temporaryPassword: z.string().min(8).max(72),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
