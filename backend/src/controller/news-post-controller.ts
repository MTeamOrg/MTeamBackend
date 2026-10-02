import type { RequestHandler } from "express";

import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import type { NewsPostService } from "../service/news-post-service.js";
import {
  createNewsPostSchema,
  newsPostIdParamsSchema,
  newsPostListQuerySchema,
  newsPostStatusUpdateSchema,
  updateNewsPostSchema,
} from "../validator/news-post-validator.js";

function serializeNewsPost(post: Awaited<ReturnType<NewsPostService["get"]>>) {
  return { ...post, publishedAt: post.publishedAt?.toISOString() ?? null };
}

export class NewsPostController {
  constructor(private readonly service: NewsPostService) {}

  list: RequestHandler = async (request, response) => {
    const validation = newsPostListQuerySchema.safeParse(request.query);
    if (!validation.success) throw this.invalid(validation.error.flatten());
    const result = await this.service.list(validation.data, request.authenticatedUser!.role);
    response.status(200).json({ ...result, items: result.items.map(serializeNewsPost) });
  };

  get: RequestHandler = async (request, response) => {
    const params = newsPostIdParamsSchema.safeParse(request.params);
    if (!params.success) throw this.invalid(params.error.flatten());
    response.status(200).json(serializeNewsPost(await this.service.get(params.data.newsPostId, request.authenticatedUser!.role)));
  };

  create: RequestHandler = async (request, response) => {
    const validation = createNewsPostSchema.safeParse(request.body);
    if (!validation.success) throw this.invalid(validation.error.flatten());
    response.status(201).json(serializeNewsPost(await this.service.create(validation.data, request.authenticatedUser!.id)));
  };

  update: RequestHandler = async (request, response) => {
    const params = newsPostIdParamsSchema.safeParse(request.params);
    const body = updateNewsPostSchema.safeParse(request.body);
    if (!params.success || !body.success) throw this.invalid({ params: params.success ? null : params.error.flatten(), body: body.success ? null : body.error.flatten() });
    response.status(200).json(serializeNewsPost(await this.service.update(params.data.newsPostId, body.data)));
  };

  updateStatus: RequestHandler = async (request, response) => {
    const params = newsPostIdParamsSchema.safeParse(request.params);
    const body = newsPostStatusUpdateSchema.safeParse(request.body);
    if (!params.success || !body.success) throw this.invalid({ params: params.success ? null : params.error.flatten(), body: body.success ? null : body.error.flatten() });
    response.status(200).json(serializeNewsPost(await this.service.updateStatus(params.data.newsPostId, body.data)));
  };

  private invalid(details: unknown) {
    return new ApplicationError(400, ERROR_CODE.VALIDATION_ERROR, "Los datos de la novedad no son válidos", details);
  }
}
