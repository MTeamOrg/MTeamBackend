import { z } from "zod";

export const publicationAudienceSchema = z.enum(["ALL", "MEMBERS", "TRAINERS"]);
export const publicationStatusSchema = z.enum(["DRAFT", "PUBLISHED", "INACTIVE"]);

const paginationSchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const newsFields = {
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1),
  imageUrl: z.union([z.url().max(2048), z.null()]).optional(),
  audience: publicationAudienceSchema,
};

export const createNewsPostSchema = z.strictObject({
  ...newsFields,
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
});

export const updateNewsPostSchema = z.strictObject({
  ...newsFields,
}).partial().refine((value) => Object.keys(value).length > 0, "Debe indicar al menos un campo");

export const newsPostListQuerySchema = paginationSchema.extend({
  search: z.string().trim().min(1).max(100).optional(),
  audience: publicationAudienceSchema.optional(),
  status: publicationStatusSchema.optional(),
});

export const newsPostIdParamsSchema = z.strictObject({ newsPostId: z.uuid() });
export const newsPostStatusUpdateSchema = z.strictObject({
  status: z.enum(["PUBLISHED", "INACTIVE"]),
});

export type CreateNewsPostInput = z.infer<typeof createNewsPostSchema>;
export type UpdateNewsPostInput = z.infer<typeof updateNewsPostSchema>;
export type NewsPostListQuery = z.infer<typeof newsPostListQuerySchema>;
export type NewsPostStatusUpdateInput = z.infer<typeof newsPostStatusUpdateSchema>;
