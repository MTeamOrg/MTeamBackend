import { Router, type RequestHandler } from "express";
import type { AccountRecoveryController } from "../controller/account-recovery-controller.js";
import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import { disablePrivateCaching } from "../middleware/api-cache-middleware.js";

export function createAccountRecoveryRouter(controller: AccountRecoveryController): Router {
  const router = Router();
  // Bounded, IP-only limiter; never varies with account existence.
  const attempts = new Map<string, { count: number; expiresAt: number }>();
  const limit: RequestHandler = (request, response, next) => {
    const now = Date.now();
    for (const [key, entry] of attempts) if (entry.expiresAt <= now) attempts.delete(key);
    const key = request.ip ?? "unknown";
    const entry = attempts.get(key) ?? { count: 0, expiresAt: now + 60_000 };
    if (entry.count >= 10 || (!attempts.has(key) && attempts.size >= 10_000)) {
      response.setHeader("Retry-After", "60");
      throw new ApplicationError(429, ERROR_CODE.RATE_LIMITED, "Esperá un minuto antes de volver a intentar.");
    }
    entry.count += 1;
    attempts.set(key, entry);
    next();
  };
  router.post("/auth/password-recovery", disablePrivateCaching, limit, controller.request);
  router.post("/auth/password-recovery/complete", disablePrivateCaching, limit, controller.complete);
  return router;
}
