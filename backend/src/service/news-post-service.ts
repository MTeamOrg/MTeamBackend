import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import type { UserRole } from "../generated/prisma/client.js";
import {
  NewsPostInvalidStatusError,
  NewsPostNotFoundError,
  type NewsPostRepositoryPort,
} from "../repository/news-post-repository.js";
import type {
  CreateNewsPostInput,
  NewsPostListQuery,
  NewsPostStatusUpdateInput,
  UpdateNewsPostInput,
} from "../validator/news-post-validator.js";

export class NewsPostService {
  constructor(private readonly repository: NewsPostRepositoryPort) {}

  list(query: NewsPostListQuery, role: UserRole) {
    return this.repository.list(query, role);
  }

  async get(id: string, role: UserRole) {
    const post = await this.repository.findById(id, role);
    if (!post) throw new ApplicationError(404, ERROR_CODE.NOT_FOUND, "La novedad no existe");
    return post;
  }

  create(input: CreateNewsPostInput, administratorId: string) {
    return this.repository.create(input, administratorId);
  }

  async update(id: string, input: UpdateNewsPostInput) {
    try {
      return await this.repository.update(id, input);
    } catch (error: unknown) {
      if (error instanceof NewsPostNotFoundError) throw new ApplicationError(404, ERROR_CODE.NOT_FOUND, "La novedad no existe");
      throw error;
    }
  }

  async updateStatus(id: string, input: NewsPostStatusUpdateInput) {
    try {
      return await this.repository.updateStatus(id, input);
    } catch (error: unknown) {
      if (error instanceof NewsPostNotFoundError) throw new ApplicationError(404, ERROR_CODE.NOT_FOUND, "La novedad no existe");
      if (error instanceof NewsPostInvalidStatusError) throw new ApplicationError(409, ERROR_CODE.CONFLICT, "El estado de la novedad no permite esta operación");
      throw error;
    }
  }
}
