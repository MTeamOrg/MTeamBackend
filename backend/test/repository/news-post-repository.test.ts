import type { PrismaClient } from "../../src/generated/prisma/client.js";
import {
  NewsPostInvalidStatusError,
  NewsPostNotFoundError,
  NewsPostRepository,
} from "../../src/repository/news-post-repository.js";
import {
  newsPostListQuerySchema,
  updateNewsPostSchema,
} from "../../src/validator/news-post-validator.js";

const item = { id: "post-id", title: "Torneo", content: "Este sábado", imageUrl: null,
  audience: "ALL", status: "PUBLISHED", publishedAt: new Date(), createdById: "admin-id" };

function setup() {
  const count = jest.fn().mockResolvedValue(1);
  const findMany = jest.fn().mockResolvedValue([item]);
  const findFirst = jest.fn().mockResolvedValue(item);
  const findUnique = jest.fn().mockResolvedValue({ id: item.id, status: "PUBLISHED" });
  const create = jest.fn().mockResolvedValue(item);
  const update = jest.fn().mockResolvedValue(item);
  const database = {
    newsPost: { count, findMany, findFirst, findUnique, create, update },
    $transaction: jest.fn().mockResolvedValue([1, [item]]),
  } as unknown as PrismaClient;
  return { repository: new NewsPostRepository(database), count, findMany, findFirst,
    findUnique, create, update, transaction: database.$transaction as jest.Mock };
}

describe("news post repository", () => {
  test("lists admin-filtered news with pagination and text search", async () => {
    const state = setup();
    const query = newsPostListQuerySchema.parse({ page: "2", limit: "5", search: " torneo ", status: "PUBLISHED", audience: "MEMBERS" });
    await expect(state.repository.list(query, "ADMIN")).resolves.toEqual({ items: [item], page: 2, limit: 5, total: 1 });
    const where = expect.objectContaining({ status: "PUBLISHED", audience: "MEMBERS",
      OR: [{ title: { contains: "torneo", mode: "insensitive" } }, { content: { contains: "torneo", mode: "insensitive" } }],
    });
    expect(state.count).toHaveBeenCalledWith({ where });
    expect(state.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: 5, take: 5 }));
    expect(state.transaction).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["MEMBER", { audience: { in: ["ALL", "MEMBERS"] }, status: "PUBLISHED" }],
    ["TRAINER", { audience: { in: ["ALL", "TRAINERS"] }, status: "PUBLISHED" }],
  ] as const)("restricts %s to published audience-eligible posts", async (role, where) => {
    const state = setup();
    await state.repository.list(newsPostListQuerySchema.parse({}), role);
    expect(state.findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
  });

  test("finds only a post visible to the caller role", async () => {
    const state = setup();
    await expect(state.repository.findById("post-id", "MEMBER")).resolves.toEqual(item);
    expect(state.findFirst).toHaveBeenCalledWith({ where: {
      audience: { in: ["ALL", "MEMBERS"] }, status: "PUBLISHED", id: "post-id",
    }, select: expect.any(Object) });
  });

  test("creates a draft without publication date and a published post with one", async () => {
    const state = setup();
    const base = { title: " Torneo ", content: " Este sábado ", audience: "ALL" as const };
    await state.repository.create({ ...base, status: "DRAFT" }, "admin-id");
    expect(state.create).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({
      title: " Torneo ", status: "DRAFT", publishedAt: null, createdById: "admin-id",
    }) }));
    await state.repository.create({ ...base, status: "PUBLISHED" }, "admin-id");
    expect(state.create).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({
      status: "PUBLISHED", publishedAt: expect.any(Date),
    }) }));
  });

  test("updates only provided fields and reports a missing post", async () => {
    const state = setup();
    await state.repository.update("post-id", updateNewsPostSchema.parse({ title: "Nuevo título" }));
    expect(state.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "post-id" }, data: { title: "Nuevo título" } }));
    state.findUnique.mockResolvedValueOnce(null);
    await expect(state.repository.update("missing", { title: "x" })).rejects.toBeInstanceOf(NewsPostNotFoundError);
  });

  test("publishes and deactivates a post, permits idempotent status, and rejects invalid transitions", async () => {
    const state = setup();
    state.findUnique.mockResolvedValueOnce({ status: "DRAFT" });
    await state.repository.updateStatus("post-id", { status: "PUBLISHED" });
    expect(state.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "PUBLISHED", publishedAt: expect.any(Date) } }));

    state.findUnique.mockResolvedValueOnce({ status: "PUBLISHED" });
    await state.repository.updateStatus("post-id", { status: "INACTIVE" });
    expect(state.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: { status: "INACTIVE" } }));

    state.findUnique.mockResolvedValueOnce({ status: "PUBLISHED" }).mockResolvedValueOnce(item);
    await state.repository.updateStatus("post-id", { status: "PUBLISHED" });
    expect(state.update).toHaveBeenCalledTimes(2);

    state.findUnique.mockResolvedValueOnce({ status: "DRAFT" });
    await expect(state.repository.updateStatus("post-id", { status: "INACTIVE" }))
      .rejects.toBeInstanceOf(NewsPostInvalidStatusError);
    state.findUnique.mockResolvedValueOnce(null);
    await expect(state.repository.updateStatus("missing", { status: "PUBLISHED" }))
      .rejects.toBeInstanceOf(NewsPostNotFoundError);
  });
});
