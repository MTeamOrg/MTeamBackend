import { z } from "zod";

export const eventStatusSchema = z.enum(["DRAFT", "PUBLISHED", "CANCELLED"]);

const paginationSchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const eventFields = {
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1),
  startsAt: z.iso.datetime({ offset: true }),
  location: z.string().trim().min(1).max(255),
  imageUrl: z.url().max(2048),
};

export const createEventSchema = z.strictObject({
  ...eventFields,
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
});

export const updateEventSchema = z.strictObject({
  ...eventFields,
}).partial().refine((value) => Object.keys(value).length > 0, "Debe indicar al menos un campo");

export const eventListQuerySchema = paginationSchema.extend({
  search: z.string().trim().min(1).max(100).optional(),
  status: eventStatusSchema.optional(),
});

export const eventIdParamsSchema = z.strictObject({ eventId: z.uuid() });
export const eventStatusUpdateSchema = z.strictObject({
  status: z.enum(["PUBLISHED", "CANCELLED"]),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type EventListQuery = z.infer<typeof eventListQuerySchema>;
export type EventStatusUpdateInput = z.infer<typeof eventStatusUpdateSchema>;
