import { z } from "zod";

import { loadEnvironmentFiles } from "./load-environment-files.js";

loadEnvironmentFiles();

const emptyOptionalValueToUndefined = (value: unknown): unknown =>
  typeof value === "string" && value.trim().length === 0 ? undefined : value;

const optionalEnvironmentUrl = z.preprocess(
  emptyOptionalValueToUndefined,
  z.url().optional(),
);

const optionalEnvironmentString = z.preprocess(
  emptyOptionalValueToUndefined,
  z.string().trim().min(1).optional(),
);

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_ENV: z
    .enum(["development", "test", "staging", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().max(65_535).default(3000),
  FRONTEND_PUBLIC_URL: z.preprocess(emptyOptionalValueToUndefined,
    z.url().refine(value => {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && !url.hash && !url.search;
    }, "Use an HTTP(S) frontend URL without credentials, query or fragment").optional()),
  GOOGLE_SMTP_USER: z.preprocess(
    emptyOptionalValueToUndefined,
    z.email().optional(),
  ),
  GOOGLE_APP_PASSWORD: optionalEnvironmentString,
  PASSWORD_RECOVERY_LOG_TEST_EMAIL: z.preprocess(
    emptyOptionalValueToUndefined,
    z.email().optional(),
  ),
  CORS_ORIGIN: z.url().default("http://localhost:5173"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().trim().min(1),
  JWT_EXPIRES_IN: z.coerce.number().int().positive().max(2_147_483_647).default(3600),
  SUPABASE_URL: optionalEnvironmentUrl,
  SUPABASE_SECRET_KEY: optionalEnvironmentString,
  SUPABASE_SERVICE_ROLE_KEY: optionalEnvironmentString,
  SUPABASE_STORAGE_BUCKET: optionalEnvironmentString,
  SUPABASE_PROFILE_PHOTO_BUCKET: optionalEnvironmentString,
});

const result = environmentSchema.safeParse(process.env);

if (!result.success) {
  throw new Error(
    `Invalid environment configuration: ${z.prettifyError(result.error)}`,
  );
}

if (Boolean(result.data.GOOGLE_SMTP_USER) !== Boolean(result.data.GOOGLE_APP_PASSWORD)) {
  throw new Error(
    "Invalid environment configuration: GOOGLE_SMTP_USER and GOOGLE_APP_PASSWORD must be configured together",
  );
}

if (result.data.PASSWORD_RECOVERY_LOG_TEST_EMAIL && result.data.APP_ENV !== "staging") {
  throw new Error(
    "PASSWORD_RECOVERY_LOG_TEST_EMAIL can only be configured when APP_ENV=staging",
  );
}

export const environment = result.data;
