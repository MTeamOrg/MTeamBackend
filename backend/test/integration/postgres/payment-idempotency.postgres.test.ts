import { randomUUID } from "node:crypto";

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

describe("payment accreditation idempotency (PostgreSQL)", () => {
  test("concurrent duplicate requests create one payment and mismatched reuse conflicts", async () => {
    const administrator = await fixtures.user("ADMIN");
    const member = await fixtures.user("MEMBER");
    const idempotencyKey = randomUUID();
    const body = {
      memberId: member.id,
      amount: 32000.25,
      method: "TRANSFER",
      receiptNumber: "FIXTURE-001",
    };
    const create = () => request(app)
      .post("/api/payments")
      .set(bearer(administrator))
      .set("Idempotency-Key", idempotencyKey)
      .send(body);

    const [first, retry] = await Promise.all([create(), create()]);
    expect([first.status, retry.status]).toEqual([201, 201]);
    expect(first.body.id).toBe(retry.body.id);
    expect(first.body).not.toHaveProperty("idempotencyKey");
    expect(retry.body).not.toHaveProperty("idempotencyKey");

    const persisted = await database.payment.findMany({ where: { idempotencyKey } });
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({
      memberId: member.id,
      createdById: administrator.id,
      method: "TRANSFER",
      receiptNumber: "FIXTURE-001",
      status: "ACCREDITED",
    });
    expect(persisted[0]!.amount.toString()).toBe("32000.25");
    expect(persisted[0]!.expiresAt.getTime() - persisted[0]!.accreditedAt.getTime())
      .toBe(30 * 24 * 60 * 60 * 1000);

    const conflict = await request(app)
      .post("/api/payments")
      .set(bearer(administrator))
      .set("Idempotency-Key", idempotencyKey)
      .send({ ...body, amount: 35000 });
    expect(conflict.status).toBe(409);
    expect(await database.payment.count({ where: { idempotencyKey } })).toBe(1);
  });
});
