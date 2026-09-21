import { Router } from "express";

import { database } from "../config/database.js";
import { environment } from "../config/environment.js";
import { AuthController } from "../controller/auth-controller.js";
import { UserController } from "../controller/user-controller.js";
import { createAuthenticationMiddleware } from "../middleware/authentication-middleware.js";
import { UserRepository } from "../repository/user-repository.js";
import { AuthService } from "../service/auth-service.js";
import { PasswordService } from "../service/password-service.js";
import { TokenService } from "../service/token-service.js";
import { UserService } from "../service/user-service.js";
import { createAuthRouter, createProtectedAuthRouter } from "./auth-route.js";
import { healthRouter } from "./health-route.js";
import { createUserRouter } from "./user-route.js";

export const apiRouter = Router();

const userRepository = new UserRepository(database);
const passwordService = new PasswordService();
const tokenService = new TokenService(environment.JWT_SECRET, environment.JWT_EXPIRES_IN);
const authService = new AuthService(userRepository, passwordService, tokenService);
const authController = new AuthController(authService);
const userService = new UserService(userRepository);
const userController = new UserController(userService);
const authenticate = createAuthenticationMiddleware(tokenService, userRepository);

apiRouter.use(healthRouter);
apiRouter.use(createAuthRouter(authController));
apiRouter.use(createProtectedAuthRouter(authController, authenticate));
apiRouter.use(createUserRouter(userController, authenticate));
