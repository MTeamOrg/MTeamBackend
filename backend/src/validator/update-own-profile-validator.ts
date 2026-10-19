import { z } from "zod";

export const updateOwnProfileSchema = z
  .strictObject({
    specialty: z.string().trim().min(1).max(150).optional(),
    description: z.string().trim().min(1).optional(),
    email: z.email().trim().max(255).optional(),
    phone: z.string().trim().min(1).max(30).optional(),
    emergencyContactName: z.string().trim().min(1).max(200).optional(),
    emergencyContactPhone: z.string().trim().min(1).max(30).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Debe indicar al menos un dato para actualizar",
  });

export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>;
