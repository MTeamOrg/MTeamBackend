import type { RequestHandler } from "express";

import type { AdminDashboardService } from "../service/admin-dashboard-service.js";

export class AdminDashboardController {
  constructor(private readonly service: AdminDashboardService) {}

  getMetrics: RequestHandler = async (_request, response) => {
    response.status(200).json(await this.service.getMetrics());
  };
}
