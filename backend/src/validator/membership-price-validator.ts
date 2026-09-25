import { z } from "zod";

export const createMembershipPriceSchema = z.strictObject({
  amount: z.number().finite().positive().max(9_999_999_999.99).refine(
    (value) => /^\d+(?:\.\d{1,2})?$/.test(value.toString()),
    "El importe debe tener como máximo dos decimales",
  ),
  effectiveFrom: z.iso.datetime({ offset: true }),
});

export const membershipPriceListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateMembershipPriceInput = z.infer<typeof createMembershipPriceSchema>;
