import request from "supertest";
import type { Express } from "express";

let app: Express;
const configuredOrigin = "http://localhost:5173";

beforeAll(async () => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.JWT_SECRET = "test-secret";
  process.env.CORS_ORIGIN = configuredOrigin;
  ({ app } = await import("../../src/app.js"));
});

describe("CORS", () => {
  test("allows the configured frontend origin", async () => {
    const response = await request(app)
      .options("/api/health")
      .set("Origin", configuredOrigin)
      .set("Access-Control-Request-Method", "GET");

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(
      configuredOrigin,
    );
  });

  test("does not authorize an unrelated origin", async () => {
    const response = await request(app)
      .options("/api/health")
      .set("Origin", "https://untrusted.example")
      .set("Access-Control-Request-Method", "GET");

    expect(response.headers["access-control-allow-origin"]).not.toBe(
      "https://untrusted.example",
    );
  });
});
