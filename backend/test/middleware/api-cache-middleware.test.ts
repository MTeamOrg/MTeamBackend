import express from "express";
import request from "supertest";

import { app } from "../../src/app.js";
import { disablePrivateCaching } from "../../src/middleware/api-cache-middleware.js";

describe("disablePrivateCaching", () => {
  test("returns a body instead of a 304 for a conditional private request", async () => {
    const privateApp = express();
    privateApp.use("/api", disablePrivateCaching);
    privateApp.get("/api/medical-certificates", (_request, response) => {
      response.json({ items: [], total: 0 });
    });

    const firstResponse = await request(privateApp).get("/api/medical-certificates");
    const secondResponse = await request(privateApp)
      .get("/api/medical-certificates")
      .set("If-None-Match", firstResponse.headers.etag);

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.headers["cache-control"]).toBe("private, no-store");
    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body).toEqual({ items: [], total: 0 });
    expect(secondResponse.headers["cache-control"]).toBe("private, no-store");
  });

  test("does not disable conditional caching globally", async () => {
    const firstResponse = await request(app).get("/api/health");
    const secondResponse = await request(app)
      .get("/api/health")
      .set("If-None-Match", firstResponse.headers.etag);

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.headers.etag).toBeDefined();
    expect(firstResponse.headers["cache-control"]).toBeUndefined();
    expect(secondResponse.status).toBe(304);
    expect(secondResponse.text).toBe("");
  });
});
