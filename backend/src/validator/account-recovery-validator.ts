import { z } from "zod";

export const requestRecoverySchema = z.strictObject({
  email: z.string().trim().toLowerCase().pipe(z.email().max(255)),
});
export const completeRecoverySchema = z.strictObject({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  newPassword: z.string().min(8).max(72),
});
