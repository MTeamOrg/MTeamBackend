import { Router } from "express";

import type { TrainerController } from "../controller/trainer-controller.js";

export function createTrainerRouter(controller: TrainerController): Router {
  const router = Router();
  router.get("/trainers", controller.listTrainers);
  return router;
}
