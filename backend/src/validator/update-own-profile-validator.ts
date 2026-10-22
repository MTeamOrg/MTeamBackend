import { z } from "zod";

const PHONE_PATTERN = /^(?:[1-9][0-9]{9}|\+54(?:9)?[1-9][0-9]{9})$/;
const phoneSchema = z.string().trim().min(1).max(30).refine(
  (value) => /^[+0-9 ()-]+$/.test(value) && PHONE_PATTERN.test(value.replace(/[ ()-]/g, "")),
  { message: "Ingresá 10 dígitos nacionales o +54 (opcionalmente 9) seguido de 10 dígitos" },
);

export const updateOwnProfileSchema = z
  .strictObject({
    email: z.string().trim().pipe(z.email().max(255)).optional(),
    phone: phoneSchema.optional(),
    emergencyContactName: z.string().trim().min(1).max(200).optional(),
    emergencyContactPhone: phoneSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Debe indicar al menos un dato para actualizar",
  });

export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>;
