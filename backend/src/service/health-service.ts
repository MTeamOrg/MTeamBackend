import { environment } from "../config/environment.js";

export class HealthService {
  getStatus() {
    return {
      status: "ok" as const,
      environment: environment.APP_ENV,
    };
  }
}
