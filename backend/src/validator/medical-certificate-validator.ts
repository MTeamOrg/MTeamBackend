import { z } from "zod";

export const medicalCertificateStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);

const paginationSchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const ownMedicalCertificateListQuerySchema = paginationSchema;

const dateTimeSchema = z.iso.datetime({ offset: true });

export const adminMedicalCertificateListQuerySchema = paginationSchema.extend({
  search: z.string().trim().min(1).max(100).optional(),
  memberId: z.uuid().optional(),
  status: medicalCertificateStatusSchema.optional(),
  from: dateTimeSchema.optional(),
  to: dateTimeSchema.optional(),
}).refine((value) => !value.from || !value.to || new Date(value.from) < new Date(value.to), {
  path: ["to"],
  message: "La fecha final debe ser posterior a la inicial",
});

export const medicalCertificateIdParamsSchema = z.strictObject({
  certificateId: z.uuid(),
});

export const medicalReviewSchema = z.strictObject({
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewComment: z.string().trim().max(1000).optional(),
}).superRefine((value, context) => {
  if (value.status === "REJECTED" && !value.reviewComment) {
    context.addIssue({
      code: "custom",
      path: ["reviewComment"],
      message: "El rechazo requiere una observación",
    });
  }
});

export type OwnMedicalCertificateListQuery = z.infer<typeof ownMedicalCertificateListQuerySchema>;
export type AdminMedicalCertificateListQuery = z.infer<typeof adminMedicalCertificateListQuerySchema>;
export type MedicalReviewInput = z.infer<typeof medicalReviewSchema>;
