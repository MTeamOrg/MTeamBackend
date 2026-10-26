import { resolve } from "node:path";

import { config } from "dotenv";

export function loadEnvironmentFiles(): void {
  const appEnvironment = process.env.APP_ENV ?? process.env.NODE_ENV ?? "development";
  config({
    path: [
      resolve(process.cwd(), `.env.${appEnvironment}.local`),
      resolve(process.cwd(), ".env"),
    ],
    override: false,
    quiet: true,
  });
}
