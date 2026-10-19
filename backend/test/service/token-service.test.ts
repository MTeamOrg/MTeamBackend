import jwt from "jsonwebtoken";

import { TokenService } from "../../src/service/token-service.js";

describe("TokenService", () => {
  test("uses the configured lifetime and signs only allowed claims for any role", () => {
    const secret = "fictional-secret-for-token-service-tests";
    const service = new TokenService(secret, 120);
    for (const role of ["ADMIN", "TRAINER", "MEMBER"] as const) {
      const now = Math.floor(Date.now() / 1000);
      const token = service.sign({ id: "test-user-id", role });
      const claims = jwt.verify(token, secret, { algorithms: ["HS256"] }) as jwt.JwtPayload;
      expect(claims).toEqual({
        sub: "test-user-id",
        role,
        sessionVersion: 0,
        exp: expect.any(Number),
      });
      expect(claims.exp).toBeGreaterThanOrEqual(now + 120);
      expect(claims.exp).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 120);
    }
  });

  test.each([0, -1, 1.5, NaN, Infinity])("rejects invalid lifetime %s", (expiresIn) => {
    expect(() => new TokenService("test-only", expiresIn)).toThrow("Invalid JWT configuration");
  });

  test("rejects empty secrets", () => {
    expect(() => new TokenService("  ", 3600)).toThrow("Invalid JWT configuration");
  });

  test("treats legacy tokens without a session version as version zero", () => {
    const token = jwt.sign(
      { sub: "83cd902e-0475-4c92-943c-129b751dacee", role: "MEMBER" },
      "legacy-token-test-secret",
      { algorithm: "HS256", expiresIn: 3600 },
    );
    expect(new TokenService("legacy-token-test-secret", 3600).verify(token))
      .toEqual({ sub: "83cd902e-0475-4c92-943c-129b751dacee", sessionVersion: 0 });
  });
});
