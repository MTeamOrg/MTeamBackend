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
      expect(claims).toEqual({ sub: "test-user-id", role, exp: expect.any(Number) });
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
});
