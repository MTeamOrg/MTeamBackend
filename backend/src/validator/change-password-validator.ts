import { z } from "zod";

export const changePasswordSchema = z
  .strictObject({
    currentPassword: z.string().min(1).max(72),
    newPassword: z.string().min(8).max(72),
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "La contraseña nueva debe ser diferente de la actual",
    path: ["newPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
