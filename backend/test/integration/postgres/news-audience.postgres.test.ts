import { randomUUID } from "node:crypto";

import request from "supertest";

import { bearer, createFixtures, createIntegrationApp, database, type TestUser } from "./support/postgres-fixtures.js";

/**
 * NOV-01 / NOV-02: the news section is its own module. Each role reads only the published posts addressed
 * to it, an inactive post disappears for them, and none of this creates personal notifications (NOV-03
 * lists the events that do, and a news post is not one of them).
 */
const fixtures = createFixtures();
const app = createIntegrationApp();

afterEach(async () => {
  await fixtures.cleanup();
});

afterAll(async () => {
  await database.$disconnect();
});

async function visibleTitles(user: TestUser, tag: string): Promise<string[]> {
  const response = await request(app).get("/api/news-posts?limit=100").set(bearer(user));
  expect(response.status).toBe(200);
  return (response.body.items as Array<{ title: string }>)
    .map(({ title }) => title)
    .filter((title) => title.startsWith(tag))
    .map((title) => title.slice(tag.length + 1))
    .sort();
}

describe("news posts by audience and state", () => {
  test("each role sees only the published posts addressed to it, and the administrator sees everything", async () => {
    const admin = await fixtures.user("ADMIN");
    const member = await fixtures.user("MEMBER");
    const trainer = await fixtures.user("TRAINER");
    const tag = randomUUID();
    for (const [audience, status] of [
      ["ALL", "PUBLISHED"], ["MEMBERS", "PUBLISHED"], ["TRAINERS", "PUBLISHED"],
      ["ALL", "DRAFT"], ["MEMBERS", "INACTIVE"], ["TRAINERS", "DRAFT"],
    ] as const) {
      await fixtures.newsPost(admin.id, audience, status, `${tag} ${audience}/${status}`);
    }

    expect(await visibleTitles(member, tag)).toEqual(["ALL/PUBLISHED", "MEMBERS/PUBLISHED"]);
    expect(await visibleTitles(trainer, tag)).toEqual(["ALL/PUBLISHED", "TRAINERS/PUBLISHED"]);
    expect(await visibleTitles(admin, tag)).toEqual([
      "ALL/DRAFT", "ALL/PUBLISHED", "MEMBERS/INACTIVE", "MEMBERS/PUBLISHED", "TRAINERS/DRAFT", "TRAINERS/PUBLISHED",
    ]);
  });

  test("a post of another audience, a draft or an inactive post answers 404 to its reader, who cannot guess its address", async () => {
    const admin = await fixtures.user("ADMIN");
    const member = await fixtures.user("MEMBER");
    const trainer = await fixtures.user("TRAINER");
    const forTrainers = await fixtures.newsPost(admin.id, "TRAINERS", "PUBLISHED");
    const draft = await fixtures.newsPost(admin.id, "ALL", "DRAFT");
    const inactive = await fixtures.newsPost(admin.id, "ALL", "INACTIVE");
    const forAll = await fixtures.newsPost(admin.id, "ALL", "PUBLISHED");

    for (const hidden of [forTrainers, draft, inactive]) {
      expect((await request(app).get(`/api/news-posts/${hidden.id}`).set(bearer(member))).status).toBe(404);
    }
    expect((await request(app).get(`/api/news-posts/${forTrainers.id}`).set(bearer(trainer))).status).toBe(200);
    expect((await request(app).get(`/api/news-posts/${forAll.id}`).set(bearer(member))).status).toBe(200);
    expect((await request(app).get(`/api/news-posts/${draft.id}`).set(bearer(admin))).status).toBe(200);
  });

  test("the administrator publishes, edits and deactivates a post and each state change is what readers see next", async () => {
    const admin = await fixtures.user("ADMIN");
    const member = await fixtures.user("MEMBER");
    const trainer = await fixtures.user("TRAINER");
    const tag = randomUUID();

    const created = await request(app).post("/api/news-posts").set(bearer(admin))
      .send({ title: `${tag} Feriado`, content: "El gimnasio abre en horario reducido.", audience: "MEMBERS" });
    expect(created.status).toBe(201);
    await fixtures.trackNewsPostsBy(admin.id);
    expect(created.body).toMatchObject({ status: "DRAFT", audience: "MEMBERS", publishedAt: null });
    expect(await visibleTitles(member, tag)).toEqual([]); // a draft is not published

    const published = await request(app).patch(`/api/news-posts/${created.body.id}/status`).set(bearer(admin)).send({ status: "PUBLISHED" });
    expect(published.status).toBe(200);
    expect(published.body.publishedAt).toEqual(expect.any(String));
    expect(await visibleTitles(member, tag)).toEqual(["Feriado"]);
    expect(await visibleTitles(trainer, tag)).toEqual([]); // addressed to members only

    const widened = await request(app).patch(`/api/news-posts/${created.body.id}`).set(bearer(admin)).send({ audience: "ALL", title: `${tag} Feriado nacional` });
    expect(widened.status).toBe(200);
    expect(await visibleTitles(trainer, tag)).toEqual(["Feriado nacional"]);

    const deactivated = await request(app).patch(`/api/news-posts/${created.body.id}/status`).set(bearer(admin)).send({ status: "INACTIVE" });
    expect(deactivated.status).toBe(200);
    expect(await visibleTitles(member, tag)).toEqual([]);
    expect(await visibleTitles(trainer, tag)).toEqual([]);
    expect(await visibleTitles(admin, tag)).toEqual(["Feriado nacional"]); // the history is kept for the administrator
  });

  test("only an administrator can write, and a draft can never be deactivated", async () => {
    const admin = await fixtures.user("ADMIN");
    const member = await fixtures.user("MEMBER");
    const trainer = await fixtures.user("TRAINER");
    const body = { title: "No autorizado", content: "x", audience: "ALL" };
    for (const reader of [member, trainer]) {
      expect((await request(app).post("/api/news-posts").set(bearer(reader)).send(body)).status).toBe(403);
    }
    expect((await request(app).post("/api/news-posts").send(body)).status).toBe(401);
    expect(await database.newsPost.count({ where: { title: "No autorizado" } })).toBe(0);

    const draft = await fixtures.newsPost(admin.id, "ALL", "DRAFT");
    expect((await request(app).patch(`/api/news-posts/${draft.id}/status`).set(bearer(admin)).send({ status: "INACTIVE" })).status).toBe(409);
  });

  test("publishing, editing or deactivating news never creates a personal notification", async () => {
    const admin = await fixtures.user("ADMIN");
    const member = await fixtures.user("MEMBER");
    const trainer = await fixtures.user("TRAINER");
    const created = await request(app).post("/api/news-posts").set(bearer(admin))
      .send({ title: "Mantenimiento", content: "La sede central cierra el sábado.", audience: "ALL", status: "PUBLISHED" });
    expect(created.status).toBe(201);
    await fixtures.trackNewsPostsBy(admin.id);
    await request(app).patch(`/api/news-posts/${created.body.id}`).set(bearer(admin)).send({ content: "La sede central cierra el domingo." });
    await request(app).patch(`/api/news-posts/${created.body.id}/status`).set(bearer(admin)).send({ status: "INACTIVE" });

    expect(await database.notification.count({ where: { userId: { in: [admin.id, member.id, trainer.id] } } })).toBe(0);
  });
});
