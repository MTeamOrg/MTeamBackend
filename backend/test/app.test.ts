import assert from "node:assert/strict";
import { describe, it } from "node:test";

import request from "supertest";

import { app } from "../src/app.js";

describe("documentación de la API", () => {
  it("sirve Swagger UI", async () => {
    const response = await request(app).get("/api/docs/");

    assert.equal(response.status, 200);
    assert.match(response.text, /id="swagger-ui"/);
    assert.match(response.text, /M-Team API/);
  });

  it("publica el mismo contrato OpenAPI que usa Swagger UI", async () => {
    const response = await request(app).get("/api/docs/openapi.json");

    assert.equal(response.status, 200);
    assert.equal(response.type, "application/json");
    assert.equal(response.body.openapi, "3.1.0");
    assert.ok(response.body.paths["/health"]);
  });
});

describe("health check", () => {
  it("informa que el ambiente de prueba está disponible", async () => {
    const response = await request(app).get("/api/health");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      status: "ok",
      environment: "test",
    });
  });
});
