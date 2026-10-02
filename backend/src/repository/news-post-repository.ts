import type { Prisma, PrismaClient, UserRole } from "../generated/prisma/client.js";
import type {
  CreateNewsPostInput,
  NewsPostListQuery,
  NewsPostStatusUpdateInput,
  UpdateNewsPostInput,
} from "../validator/news-post-validator.js";

const newsPostSelect = {
  id: true,
  title: true,
  content: true,
  imageUrl: true,
  audience: true,
  status: true,
  publishedAt: true,
  createdById: true,
} as const satisfies Prisma.NewsPostSelect;

export type NewsPostRecord = Prisma.NewsPostGetPayload<{ select: typeof newsPostSelect }>;

export interface NewsPostList {
  items: NewsPostRecord[];
  page: number;
  limit: number;
  total: number;
}

export class NewsPostNotFoundError extends Error {}
export class NewsPostInvalidStatusError extends Error {}

export interface NewsPostRepositoryPort {
  list(query: NewsPostListQuery, role: UserRole): Promise<NewsPostList>;
  findById(id: string, role: UserRole): Promise<NewsPostRecord | null>;
  create(input: CreateNewsPostInput, administratorId: string): Promise<NewsPostRecord>;
  update(id: string, input: UpdateNewsPostInput): Promise<NewsPostRecord>;
  updateStatus(id: string, input: NewsPostStatusUpdateInput): Promise<NewsPostRecord>;
}

export class NewsPostRepository implements NewsPostRepositoryPort {
  constructor(private readonly database: PrismaClient) {}

  async list(query: NewsPostListQuery, role: UserRole): Promise<NewsPostList> {
    const where = this.buildWhere(query, role);
    const [total, items] = await this.database.$transaction([
      this.database.newsPost.count({ where }),
      this.database.newsPost.findMany({
        where,
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: newsPostSelect,
      }),
    ]);
    return { items, page: query.page, limit: query.limit, total };
  }

  findById(id: string, role: UserRole): Promise<NewsPostRecord | null> {
    return this.database.newsPost.findFirst({ where: { ...this.buildWhere({ page: 1, limit: 1 }, role), id }, select: newsPostSelect });
  }

  create(input: CreateNewsPostInput, administratorId: string): Promise<NewsPostRecord> {
    return this.database.newsPost.create({
      data: {
        title: input.title,
        content: input.content,
        imageUrl: input.imageUrl ?? null,
        audience: input.audience,
        status: input.status,
        publishedAt: input.status === "PUBLISHED" ? new Date() : null,
        createdById: administratorId,
      },
      select: newsPostSelect,
    });
  }

  update(id: string, input: UpdateNewsPostInput): Promise<NewsPostRecord> {
    return this.database.newsPost.findUnique({ where: { id }, select: { id: true } }).then((current) => {
      if (!current) throw new NewsPostNotFoundError();
      return this.database.newsPost.update({
      where: { id },
      data: {
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.content === undefined ? {} : { content: input.content }),
        ...(input.imageUrl === undefined ? {} : { imageUrl: input.imageUrl }),
        ...(input.audience === undefined ? {} : { audience: input.audience }),
      },
      select: newsPostSelect,
      });
    });
  }

  async updateStatus(id: string, input: NewsPostStatusUpdateInput): Promise<NewsPostRecord> {
    const current = await this.database.newsPost.findUnique({ where: { id }, select: { status: true } });
    if (!current) throw new NewsPostNotFoundError();
    if (current.status === input.status) return (await this.database.newsPost.findUnique({ where: { id }, select: newsPostSelect }))!;
    if (input.status === "INACTIVE" && current.status !== "PUBLISHED") throw new NewsPostInvalidStatusError();
    const data: Prisma.NewsPostUncheckedUpdateInput = {
      status: input.status,
      ...(input.status === "PUBLISHED" ? { publishedAt: new Date() } : {}),
    };
    return this.database.newsPost.update({
      where: { id },
      data,
      select: newsPostSelect,
    });
  }

  private buildWhere(query: NewsPostListQuery, role: UserRole): Prisma.NewsPostWhereInput {
    const where: Prisma.NewsPostWhereInput = this.buildAudienceWhere(role);
    if (role !== "ADMIN") {
      where.status = "PUBLISHED";
    } else {
      if (query.status) where.status = query.status;
      if (query.audience) where.audience = query.audience;
    }
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: "insensitive" } },
        { content: { contains: query.search, mode: "insensitive" } },
      ];
    }
    return where;
  }

  private buildAudienceWhere(role: UserRole): Prisma.NewsPostWhereInput {
    if (role === "ADMIN") return {};
    return { audience: role === "MEMBER" ? { in: ["ALL", "MEMBERS"] } : { in: ["ALL", "TRAINERS"] } };
  }
}
