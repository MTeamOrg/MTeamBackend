import express from "express";

import type { UserRole } from "../../src/generated/prisma/client.js";
import { createAuthenticationMiddleware } from "../../src/middleware/authentication-middleware.js";
import { authorize } from "../../src/middleware/authorization-middleware.js";
import { errorMiddleware } from "../../src/middleware/error-middleware.js";
import type { AccessControlUser, UserAccessRepositoryPort } from "../../src/repository/user-repository.js";
import { TokenService } from "../../src/service/token-service.js";

export const testSecret = "fictional-secret-only-for-access-control-tests";
export const userId = "83cd902e-0475-4c92-943c-129b751dacee";

export function createAccessControlApp(roles?: UserRole[]) {
  const currentUser: AccessControlUser = { id: userId, role: "MEMBER", status: "ACTIVE" };
  const repository: jest.Mocked<UserAccessRepositoryPort> = {
    findAccessControlUserById: jest.fn().mockImplementation(async () => ({ ...currentUser })),
  };
  const tokens = new TokenService(testSecret, 3600);
  const controller = jest.fn((req, res) => res.json(req.authenticatedUser));
  const app = express();
  app.use(express.json());
  app.post(
    "/private",
    createAuthenticationMiddleware(tokens, repository),
    ...(roles ? [authorize(...roles)] : []),
    controller,
  );
  app.use(errorMiddleware);
  return { app, repository, tokens, currentUser, controller };
}
