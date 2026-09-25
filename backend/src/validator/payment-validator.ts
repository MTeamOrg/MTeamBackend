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
