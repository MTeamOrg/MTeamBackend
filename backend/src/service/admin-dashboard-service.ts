import type {
  AdminDashboardMetrics,
  AdminDashboardRepositoryPort,
} from "../repository/admin-dashboard-repository.js";

export class AdminDashboardService {
  constructor(private readonly repository: AdminDashboardRepositoryPort) {}

  getMetrics(now = new Date()): Promise<AdminDashboardMetrics> {
    return this.repository.getMetrics(now);
  }
}
