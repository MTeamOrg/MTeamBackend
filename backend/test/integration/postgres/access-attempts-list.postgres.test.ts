import request from "supertest";

import { bearer, createFixtures, createIntegrationApp, database } from "./support/postgres-fixtures.js";

const fixtures = createFixtures();
const app = createIntegrationApp();

afterEach(async () => {
  await fixtures.cleanup();
});

afterAll(async () => {
  await database.$disconnect();
});

describe("administrative access-attempt listing (PostgreSQL)", () => {
  test("reads persisted attempts, applies combined filters and paginates newest first", async () => {
    const administrator = await fixtures.user("ADMIN");
    const member = await fixtures.user("MEMBER", {
      firstName: "AccessFilterUnique",
      lastName: "Member",
      documentNumber: "ACCESS-FILTER-001",
    });
    const trainer = await fixtures.user("TRAINER", { firstName: "Other", lastName: "Trainer" });
    const caballito = await fixtures.branch(`Access filter ${member.id}`);
    const palermo = await fixtures.branch(`Other access ${trainer.id}`);
    const caballitoPoint = await fixtures.accessPoint(caballito.id, "Caballito gate");
    const palermoPoint = await fixtures.accessPoint(palermo.id, "Palermo gate");

    await fixtures.accessAttempt({
      userId: member.id, roleAtAttempt: "MEMBER", branchId: caballito.id,
      accessPointId: caballitoPoint.id, result: "ALLOWED", attemptedAt: "2026-10-10T12:00:00.000Z",
    });
    await fixtures.accessAttempt({
      userId: member.id, roleAtAttempt: "MEMBER", branchId: caballito.id,
      accessPointId: caballitoPoint.id, result: "DENIED", denialReason: "EXPIRED_MEMBERSHIP",
      attemptedAt: "2026-10-11T12:00:00.000Z",
    });
    await fixtures.accessAttempt({
      userId: trainer.id, roleAtAttempt: "TRAINER", branchId: palermo.id,
      accessPointId: palermoPoint.id, result: "DENIED", denialReason: "INACTIVE_ACCESS_POINT",
      attemptedAt: "2026-10-12T12:00:00.000Z",
    });

    const filtered = await request(app).get("/api/access-attempts")
      .query({
        search: "AccessFilterUnique",
        role: "MEMBER",
        branchId: caballito.id,
        result: "DENIED",
        from: "2026-10-10T00:00:00.000Z",
        to: "2026-10-12T00:00:00.000Z",
        page: 1,
        limit: 1,
      })
      .set(bearer(administrator));

    expect(filtered.status).toBe(200);
    expect(filtered.body).toMatchObject({ page: 1, limit: 1, total: 1 });
    expect(filtered.body.items).toHaveLength(1);
    expect(filtered.body.items[0]).toMatchObject({
      user: { id: member.id, firstName: "AccessFilterUnique", documentNumber: "ACCESS-FILTER-001" },
      branch: { id: caballito.id },
      accessPoint: { id: caballitoPoint.id, name: "Caballito gate" },
      roleAtAttempt: "MEMBER",
      result: "DENIED",
      denialReason: "EXPIRED_MEMBERSHIP",
      attemptedAt: "2026-10-11T12:00:00.000Z",
    });

    const firstPage = await request(app).get("/api/access-attempts?limit=1&page=1").set(bearer(administrator));
    const secondPage = await request(app).get("/api/access-attempts?limit=1&page=2").set(bearer(administrator));
    expect(firstPage.status).toBe(200);
    expect(secondPage.status).toBe(200);
    expect(firstPage.body.total).toBe(3);
    expect(firstPage.body.items[0].user.id).toBe(trainer.id);
    expect(secondPage.body.items[0].user.id).toBe(member.id);
    expect(firstPage.body.items[0].attemptedAt > secondPage.body.items[0].attemptedAt).toBe(true);
  });
});
