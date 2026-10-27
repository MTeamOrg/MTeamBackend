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

  test("two administrators voiding the same payment concurrently produce one winner", async () => {
    const firstAdmin = await fixtures.user("ADMIN");
    const secondAdmin = await fixtures.user("ADMIN");
    const member = await fixtures.user("MEMBER");
    const payment = await fixtures.accreditedPayment(
      member.id,
      firstAdmin.id,
      "2036-03-01T15:00:00.000Z",
      "2036-03-31T15:00:00.000Z",
    );
    const voidPayment = (admin: typeof firstAdmin, reason: string) => request(app)
      .post(`/api/payments/${payment.id}/voids`)
      .set(bearer(admin))
      .send({ reason });

    const results = await Promise.all([
      voidPayment(firstAdmin, "Anulación solicitada por administración A"),
      voidPayment(secondAdmin, "Anulación solicitada por administración B"),
    ]);

    expect(results.map(({ status }) => status).sort()).toEqual([200, 409]);
    const persisted = await database.payment.findUniqueOrThrow({ where: { id: payment.id } });
    const winnerIndex = results.findIndex(({ status }) => status === 200);
    const winningAdmin = winnerIndex === 0 ? firstAdmin : secondAdmin;
    const winningReason = winnerIndex === 0
      ? "Anulación solicitada por administración A"
      : "Anulación solicitada por administración B";
    expect(persisted).toMatchObject({
      status: "VOIDED",
      voidedById: winningAdmin.id,
      voidReason: winningReason,
    });
    expect(persisted.voidedAt).toBeInstanceOf(Date);
  });

  test("concurrent requests reusing one key with different payloads persist only the winning payload", async () => {
    const administrator = await fixtures.user("ADMIN");
    const firstMember = await fixtures.user("MEMBER");
    const secondMember = await fixtures.user("MEMBER");
    const idempotencyKey = randomUUID();
    const create = (memberId: string, amount: number) => request(app)
      .post("/api/payments")
      .set(bearer(administrator))
      .set("Idempotency-Key", idempotencyKey)
      .send({ memberId, amount, method: "CASH" });

    const results = await Promise.all([create(firstMember.id, 21000), create(secondMember.id, 27000)]);

    expect(results.map(({ status }) => status).sort()).toEqual([201, 409]);
    const persisted = await database.payment.findMany({ where: { idempotencyKey } });
    expect(persisted).toHaveLength(1);
    const winner = results.find(({ status }) => status === 201)!;
    expect(persisted[0]).toMatchObject({
      id: winner.body.id,
      memberId: winner.body.memberId,
      createdById: administrator.id,
    });
    expect(persisted[0]!.amount.toString()).toBe(winner.body.amount);
  });
});
