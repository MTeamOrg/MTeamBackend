const originalEnvironment = { ...process.env };

async function loadEnvironment(): Promise<Record<string, unknown>> {
  let parsedEnvironment: Record<string, unknown> | undefined;

  await jest.isolateModulesAsync(async () => {
    const environmentModule = await import("../../src/config/environment.js");
    parsedEnvironment = environmentModule.environment;
  });

  if (parsedEnvironment === undefined) {
    throw new Error("Environment module did not load");
  }

  return parsedEnvironment;
}

describe("environment configuration", () => {
  beforeEach(() => {
    process.env = {
      ...originalEnvironment,
      NODE_ENV: "test",
      APP_ENV: "test",
      DATABASE_URL: "postgresql://unit-test.invalid/mteam",
      JWT_SECRET: "unit-test-jwt-secret",
      CORS_ORIGIN: "http://localhost:5173",
    };

    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_STORAGE_BUCKET;
    delete process.env.SUPABASE_PROFILE_PHOTO_BUCKET;
  });

  afterAll(() => {
    process.env = originalEnvironment;
  });

  test("normalizes empty Supabase variables to undefined", async () => {
    process.env.SUPABASE_URL = "   ";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "\t";
    process.env.SUPABASE_STORAGE_BUCKET = "\r\n";
    process.env.SUPABASE_PROFILE_PHOTO_BUCKET = "";

    const environment = await loadEnvironment();

    expect(environment.SUPABASE_URL).toBeUndefined();
    expect(environment.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    expect(environment.SUPABASE_STORAGE_BUCKET).toBeUndefined();
    expect(environment.SUPABASE_PROFILE_PHOTO_BUCKET).toBeUndefined();
  });

  test("keeps validating and trimming configured Supabase variables", async () => {
    process.env.SUPABASE_URL = "https://unit-test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = " service-role-key ";
    process.env.SUPABASE_STORAGE_BUCKET = " private-documents ";
    process.env.SUPABASE_PROFILE_PHOTO_BUCKET = " profile-photos ";

    const environment = await loadEnvironment();

    expect(environment.SUPABASE_URL).toBe("https://unit-test.supabase.co");
    expect(environment.SUPABASE_SERVICE_ROLE_KEY).toBe("service-role-key");
    expect(environment.SUPABASE_STORAGE_BUCKET).toBe("private-documents");
    expect(environment.SUPABASE_PROFILE_PHOTO_BUCKET).toBe("profile-photos");
  });

  test.each([
    ["DATABASE_URL", ""],
    ["JWT_SECRET", "   "],
  ])("does not make required variable %s optional", async (name, value) => {
    process.env[name] = value;

    await expect(loadEnvironment()).rejects.toThrow(
      "Invalid environment configuration",
    );
  });
});
