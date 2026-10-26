import request from "supertest";

import { PasswordService } from "../../../src/service/password-service.js";
import { bearer, createFixtures, createIntegrationApp, database } from "./support/postgres-fixtures.js";

const fixtures = createFixtures();
const app = createIntegrationApp();

afterEach(async () => {
  await fixtures.cleanup();
});

afterAll(async () => {
  await database.$disconnect();
});

describe("administrative temporary password reset (PostgreSQL)", () => {
  test("generates and hashes a temporary password, requires its change, then restores normal access", async () => {
    const administrator = await fixtures.user("ADMIN");
    const member = await fixtures.user("MEMBER");
    const initialPassword = "initial-member-password";
    const passwordHasher = new PasswordService();
    await database.user.update({
      where: { id: member.id },
      data: { passwordHash: await passwordHasher.hash(initialPassword) },
    });
    const previousSession = await request(app).post("/api/auth/login").send({
      email: member.email,
      password: initialPassword,
    });
    expect(previousSession.status).toBe(200);

    const reset = await request(app)
      .post(`/api/users/${member.id}/password-resets`)
      .set(bearer(administrator));

    expect(reset.status).toBe(200);
    expect((await request(app).get("/api/notifications")
      .set("Authorization", "Bearer " + previousSession.body.accessToken)).status).toBe(401);
    const temporaryPassword = reset.body.temporaryPassword as string;
    expect(temporaryPassword).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const resetUser = await database.user.findUniqueOrThrow({
      where: { id: member.id },
      select: { passwordHash: true, isPasswordChangeRequired: true },
    });
    expect(resetUser.passwordHash).not.toBe(temporaryPassword);
    expect(await passwordHasher.compare(temporaryPassword, resetUser.passwordHash)).toBe(true);
    expect(resetUser.isPasswordChangeRequired).toBe(true);

    const temporaryLogin = await request(app).post("/api/auth/login").send({
      email: member.email,
      password: temporaryPassword,
    });
    expect(temporaryLogin.status).toBe(200);
    expect(temporaryLogin.body.user.isPasswordChangeRequired).toBe(true);
    const temporaryAuthorization = { Authorization: `Bearer ${temporaryLogin.body.accessToken}` };
    expect((await request(app).get("/api/notifications").set(temporaryAuthorization)).status).toBe(403);

    const finalPassword = "final-member-password";
    const changed = await request(app).patch("/api/auth/password")
      .set(temporaryAuthorization)
      .send({ currentPassword: temporaryPassword, newPassword: finalPassword });
    expect(changed.status).toBe(204);

    const oldPasswordLogin = await request(app).post("/api/auth/login").send({
      email: member.email,
      password: temporaryPassword,
    });
    expect(oldPasswordLogin.status).toBe(401);

    const finalLogin = await request(app).post("/api/auth/login").send({
      email: member.email,
      password: finalPassword,
    });
    expect(finalLogin.status).toBe(200);
    expect(finalLogin.body.user.isPasswordChangeRequired).toBe(false);
    expect((await request(app).get("/api/notifications")
      .set({ Authorization: `Bearer ${finalLogin.body.accessToken}` })).status).toBe(200);

    const audit = await request(app)
      .get(`/api/users/${member.id}/audit-logs?page=1&limit=100`)
      .set(bearer(administrator));
    expect(audit.status).toBe(200);
    const resetAudit = audit.body.items.find((item: { action: string }) => item.action === "PASSWORD_RESET");
    expect(resetAudit?.performedBy.id).toBe(administrator.id);
    expect(JSON.stringify(audit.body)).not.toContain(temporaryPassword);
    expect(JSON.stringify(audit.body)).not.toContain(finalPassword);
  });
});
