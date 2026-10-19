import express from "express";
import request from "supertest";
import { AccountRecoveryController } from "../../src/controller/account-recovery-controller.js";
import { createAccountRecoveryRouter } from "../../src/route/account-recovery-route.js";
import { errorMiddleware } from "../../src/middleware/error-middleware.js";
import { ApplicationError } from "../../src/error/application-error.js";

function setup() {
  const service = { request: jest.fn().mockResolvedValue(undefined), complete: jest.fn().mockResolvedValue(undefined) };
  const app = express(); app.use(express.json());
  app.use("/api", createAccountRecoveryRouter(new AccountRecoveryController(service)));
  app.use(errorMiddleware);
  return { app, service };
}
test("identical generic response and cache policy for existing and unknown email", async () => {
  const { app } = setup();
  const existing = await request(app).post("/api/auth/password-recovery").send({ email: "existing@example.com" });
  const unknown = await request(app).post("/api/auth/password-recovery").send({ email: "unknown@example.com" });
  expect(existing.status).toBe(202); expect(unknown.status).toBe(202);
  expect(existing.body).toEqual(unknown.body);
  expect(existing.headers["cache-control"]).toContain("no-store");
});
test("normalizes email", async () => {
  const { app, service } = setup();
  await request(app).post("/api/auth/password-recovery").send({ email: " Person@Example.com " }).expect(202);
  expect(service.request).toHaveBeenCalledWith("person@example.com");
});
test.each([{ email: "bad" }, {}, { email: "person@example.com", role: "ADMIN" }])("rejects invalid request %j", async body => {
  const { app, service } = setup();
  await request(app).post("/api/auth/password-recovery").send(body).expect(400);
  expect(service.request).not.toHaveBeenCalled();
});
test("does not report success on mail failure", async () => {
  const { app, service } = setup();
  service.request.mockRejectedValue(new ApplicationError(503, "SERVICE_UNAVAILABLE", "Intentá más tarde."));
  await request(app).post("/api/auth/password-recovery").send({ email: "person@example.com" }).expect(503);
});
test("sanitizes unexpected errors and never logs token-containing exceptions", async () => {
  const { app, service } = setup();
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  service.complete.mockRejectedValue(new Error("secret-token"));
  const response = await request(app).post("/api/auth/password-recovery/complete").send({ token: "a".repeat(64), newPassword: "new-password" });
  expect(response.status).toBe(503); expect(JSON.stringify(response.body)).not.toContain("secret-token");
  expect(log).not.toHaveBeenCalled(); log.mockRestore();
});
test("completes anonymously with no content", async () => {
  const { app, service } = setup();
  await request(app).post("/api/auth/password-recovery/complete").send({ token: "a".repeat(64), newPassword: "new-password" }).expect(204);
  expect(service.complete).toHaveBeenCalledWith("a".repeat(64), "new-password");
});
test.each(["short", "a".repeat(73)])("enforces current password length policy", async newPassword => {
  const { app, service } = setup();
  await request(app).post("/api/auth/password-recovery/complete").send({ token: "a".repeat(64), newPassword }).expect(400);
  expect(service.complete).not.toHaveBeenCalled();
});
test("limits repeated requests independently of email", async () => {
  const { app } = setup();
  for (let index = 0; index < 10; index++) await request(app).post("/api/auth/password-recovery").send({ email: `person${index}@example.com` }).expect(202);
  const response = await request(app).post("/api/auth/password-recovery").send({ email: "different@example.com" });
  expect(response.status).toBe(429); expect(response.headers["retry-after"]).toBe("60");
});
