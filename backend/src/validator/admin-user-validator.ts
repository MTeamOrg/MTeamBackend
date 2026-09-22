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

const userDataFields = {
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  documentNumber: z.string().trim().min(1).max(30),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe usar el formato AAAA-MM-DD")
    .refine((value) => {
      const date = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
    }, "La fecha no es válida")
    .refine(
      (value) => new Date(`${value}T00:00:00.000Z`) <= new Date(),
      "La fecha no puede ser futura",
    ),
  email: z.string().trim().max(255).pipe(z.email()),
  phone: z.string().trim().min(1).max(30),
  password: z.string().min(8).max(72),
};

const memberCreateSchema = z.strictObject({
  ...userDataFields,
  role: z.literal("MEMBER"),
  emergencyContactName: z.string().trim().max(200).optional(),
  emergencyContactPhone: z.string().trim().max(30).optional(),
});

const trainerCreateSchema = z.strictObject({
  ...userDataFields,
  role: z.literal("TRAINER"),
  specialty: z.string().trim().min(1).max(150),
  description: z.string().trim().min(1),
});

const adminCreateSchema = z.strictObject({
  ...userDataFields,
  role: z.literal("ADMIN"),
});

export const createAdminUserSchema = z.discriminatedUnion("role", [
  memberCreateSchema,
  trainerCreateSchema,
  adminCreateSchema,
]);

export const updateAdminUserSchema = z
  .strictObject({
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    documentNumber: z.string().trim().min(1).max(30).optional(),
    birthDate: userDataFields.birthDate.optional(),
    email: z.string().trim().max(255).pipe(z.email()).optional(),
    phone: z.string().trim().min(1).max(30).optional(),
    emergencyContactName: z.string().trim().max(200).optional(),
    emergencyContactPhone: z.string().trim().max(30).optional(),
    specialty: z.string().trim().min(1).max(150).optional(),
    description: z.string().trim().min(1).optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((value) => Object.keys(value).some((key) => key !== "reason"), {
    message: "Debe indicar al menos un campo para modificar",
  });

export type AdminUserListQueryInput = z.infer<typeof adminUserListQuerySchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
export type CreateAdminUserInput = z.infer<typeof createAdminUserSchema>;
export type UpdateAdminUserInput = z.infer<typeof updateAdminUserSchema>;
