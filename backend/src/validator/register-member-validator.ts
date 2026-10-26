import { z } from "zod";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const registerMemberSchema = z.strictObject({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  documentNumber: z.string().trim().min(1).max(30),
  birthDate: z
    .string()
    .regex(DATE_PATTERN, "La fecha de nacimiento debe usar el formato AAAA-MM-DD")
    .refine((value) => {
      const date = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
    }, "La fecha de nacimiento no es válida")
    .refine(
      (value) => new Date(`${value}T00:00:00.000Z`) <= new Date(),
      "La fecha de nacimiento no puede ser futura",
    ),
  email: z.email().trim().max(255),
  phone: z.string().trim().min(1).max(30),
  password: z.string().min(8).max(72),
  emergencyContactName: z.string().trim().max(200).optional(),
  emergencyContactPhone: z.string().trim().max(30).optional(),
});

export type RegisterMemberInput = z.infer<typeof registerMemberSchema>;
