import { z } from "zod";

export const createMembershipPriceSchema = z.strictObject({
  amount: z.number().finite().positive().max(9_999_999_999.99).refine(
    (value) => /^\d+(?:\.\d{1,2})?$/.test(value.toString()),
    "El importe debe tener como máximo dos decimales",
  ),
  effectiveFrom: z.iso.datetime({ offset: true }).refine(
    (value) => new Date(value).getTime() <= Date.now(),
    "La fecha de vigencia no puede ser futura",
  ),
});

export type CreateMembershipPriceInput = z.infer<typeof createMembershipPriceSchema>;
