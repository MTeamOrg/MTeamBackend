import { Router } from "express";

import { HealthController } from "../controller/health-controller.js";
import { HealthService } from "../service/health-service.js";

const healthController = new HealthController(new HealthService());

export const healthRouter = Router();

healthRouter.get("/health", healthController.getHealth);
