import { z } from "zod";

export const createPaymentSchema = z.strictObject({
  memberId: z.uuid(),
  amount: z.number().positive().max(9_999_999_999.99).refine(
    (value) => /^\d+(?:\.\d{1,2})?$/.test(value.toString()),
    "El importe debe tener como máximo dos decimales",
  ),
  method: z.string().trim().min(1).max(50),
  receiptNumber: z.string().trim().min(1).max(100).optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export const voidPaymentParamsSchema = z.strictObject({ paymentId: z.uuid() });

export const voidPaymentSchema = z.strictObject({
  reason: z.string().trim().min(1).max(500),
});

export type VoidPaymentInput = z.infer<typeof voidPaymentSchema>;

export const paymentHistoryQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const memberPaymentsParamsSchema = z.strictObject({ memberId: z.uuid() });

export type PaymentHistoryQuery = z.infer<typeof paymentHistoryQuerySchema>;

const dateTimeSchema = z.iso.datetime({ offset: true });

export const paymentListQuerySchema = paymentHistoryQuerySchema.extend({
  memberId: z.uuid().optional(),
  documentNumber: z.string().trim().min(1).max(30).optional(),
  from: dateTimeSchema.optional(),
  to: dateTimeSchema.optional(),
  method: z.string().trim().min(1).max(50).optional(),
  status: z.enum(["ACCREDITED", "VOIDED"]).optional(),
}).refine((value) => !value.from || !value.to || new Date(value.from) < new Date(value.to), {
  path: ["to"], message: "La fecha final debe ser posterior a la inicial",
});

export const paymentSummaryQuerySchema = z.strictObject({
  from: dateTimeSchema,
  to: dateTimeSchema,
}).refine((value) => new Date(value.from) < new Date(value.to), {
  path: ["to"], message: "La fecha final debe ser posterior a la inicial",
});

export type PaymentListQuery = z.infer<typeof paymentListQuerySchema>;
export type PaymentSummaryQuery = z.infer<typeof paymentSummaryQuerySchema>;
