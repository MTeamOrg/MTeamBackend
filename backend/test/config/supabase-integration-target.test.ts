import { assertIsolatedSupabaseIntegrationTarget } from "../integration/supabase/target-guard.js";

const projectRef = "abcdefghijklmnopqrst";
const environment = {
  SUPABASE_INTEGRATION_TARGET_KIND: "isolated-staging",
  SUPABASE_INTEGRATION_ALLOW_WRITES: "YES",
  SUPABASE_INTEGRATION_BACKUP_CONFIRMED: "YES",
  SUPABASE_INTEGRATION_PROJECT_REF: projectRef,
  SUPABASE_URL: "https://" + projectRef + ".supabase.co",
  DATABASE_URL: "postgresql://postgres." + projectRef +
    ":placeholder@aws-0-sa-east-1.pooler.supabase.com:5432/postgres",
  DIRECT_URL: "postgresql://postgres:placeholder@db." + projectRef + ".supabase.co:5432/postgres",
};

describe("Supabase write-test target guard", () => {
  test("accepts a matching isolated project only after explicit confirmations", () => {
    expect(() => assertIsolatedSupabaseIntegrationTarget(environment)).not.toThrow();
  });

  test.each([
    ["target kind", { SUPABASE_INTEGRATION_TARGET_KIND: "production" }],
    ["write confirmation", { SUPABASE_INTEGRATION_ALLOW_WRITES: undefined }],
    ["backup confirmation", { SUPABASE_INTEGRATION_BACKUP_CONFIRMED: undefined }],
    ["project URL", { SUPABASE_URL: "https://anotherproject1234567.supabase.co" }],
    ["database URL", { DATABASE_URL: "postgresql://postgres.otherproject1234567:placeholder@aws-0-sa-east-1.pooler.supabase.com:5432/postgres" }],
    ["direct URL", { DIRECT_URL: "postgresql://postgres:placeholder@db.otherproject1234567.supabase.co:5432/postgres" }],
  ])("rejects a mismatched or unconfirmed %s", (_label, override) => {
    expect(() => assertIsolatedSupabaseIntegrationTarget({ ...environment, ...override }))
      .toThrow();
  });
});
