import { z } from "zod";

import { loadEnvironmentFiles } from "./load-environment-files.js";

loadEnvironmentFiles();

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_ENV: z
    .enum(["development", "test", "staging", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().max(65_535).default(3000),
  CORS_ORIGIN: z.url().default("http://localhost:5173"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().trim().min(1),
  JWT_EXPIRES_IN: z.coerce.number().int().positive().max(2_147_483_647).default(3600),
  SUPABASE_URL: z.url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1).optional(),
  SUPABASE_STORAGE_BUCKET: z.string().trim().min(1).optional(),
  SUPABASE_PROFILE_PHOTO_BUCKET: z.string().trim().min(1).optional(),
});

const result = environmentSchema.safeParse(process.env);

if (!result.success) {
  throw new Error(
    `Invalid environment configuration: ${z.prettifyError(result.error)}`,
  );
}

export const environment = result.data;
