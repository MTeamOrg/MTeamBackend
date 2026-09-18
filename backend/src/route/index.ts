import { Router } from "express";

import { database } from "../config/database.js";
import { AuthController } from "../controller/auth-controller.js";
import { UserRepository } from "../repository/user-repository.js";
import { AuthService } from "../service/auth-service.js";
import { PasswordService } from "../service/password-service.js";
import { createAuthRouter } from "./auth-route.js";
import { healthRouter } from "./health-route.js";

export const apiRouter = Router();

const userRepository = new UserRepository(database);
const passwordService = new PasswordService();
const authService = new AuthService(userRepository, passwordService);
const authController = new AuthController(authService);

apiRouter.use(healthRouter);
apiRouter.use(createAuthRouter(authController));
