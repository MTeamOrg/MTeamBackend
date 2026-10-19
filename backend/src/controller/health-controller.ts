import type { RequestHandler } from "express";

import { HealthService } from "../service/health-service.js";

export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  getHealth: RequestHandler = (_request, response) => {
    response.status(200).json(this.healthService.getStatus());
  };
}
