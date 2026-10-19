type SupabaseIntegrationEnvironment = Record<string, string | undefined>;

function projectRefFromSupabaseUrl(value: string, variable: string): string {
  let hostname: string;
  try {
    hostname = new URL(value).hostname;
  } catch {
    throw new Error(variable + " must be a valid Supabase URL.");
  }
  const match = hostname.match(/^([a-z0-9]{20})\.supabase\.co$/);
  if (!match) throw new Error(variable + " must identify a Supabase project URL.");
  return match[1]!;
}

function projectRefFromDatabaseUrl(value: string, variable: string): string {
  let connection: URL;
  try {
    connection = new URL(value);
  } catch {
    throw new Error(variable + " must be a valid PostgreSQL URL.");
  }

  const directMatch = connection.hostname.match(/^db\.([a-z0-9]{20})\.supabase\.co$/);
  if (directMatch) return directMatch[1]!;

  if (connection.hostname.endsWith(".pooler.supabase.com")) {
    const username = decodeURIComponent(connection.username);
    const poolerMatch = username.match(/^[^.]+\.([a-z0-9]{20})$/);
    if (poolerMatch) return poolerMatch[1]!;
  }

  throw new Error(variable + " must identify its Supabase project in the host or pooler username.");
}

/**
 * The real Supabase integration suite creates application records. Require an explicit
 * isolated-project, backup, and write confirmation before it can start a backend or connect.
 */
export function assertIsolatedSupabaseIntegrationTarget(
  environment: SupabaseIntegrationEnvironment,
): void {
  if (!["isolated-development", "isolated-staging"].includes(
    environment.SUPABASE_INTEGRATION_TARGET_KIND ?? "",
  )) {
    throw new Error("Set SUPABASE_INTEGRATION_TARGET_KIND to isolated-development or isolated-staging.");
  }
  if (environment.SUPABASE_INTEGRATION_ALLOW_WRITES !== "YES") {
    throw new Error("Set SUPABASE_INTEGRATION_ALLOW_WRITES=YES only after approving this isolated test run.");
  }
  if (environment.SUPABASE_INTEGRATION_BACKUP_CONFIRMED !== "YES") {
    throw new Error("Confirm a current backup with SUPABASE_INTEGRATION_BACKUP_CONFIRMED=YES.");
  }

  const expectedRef = environment.SUPABASE_INTEGRATION_PROJECT_REF;
  if (!expectedRef || !/^[a-z0-9]{20}$/.test(expectedRef)) {
    throw new Error("Set SUPABASE_INTEGRATION_PROJECT_REF to the verified 20-character project reference.");
  }
  const urlRef = projectRefFromSupabaseUrl(environment.SUPABASE_URL ?? "", "SUPABASE_URL");
  if (urlRef !== expectedRef) {
    throw new Error("SUPABASE_URL does not match SUPABASE_INTEGRATION_PROJECT_REF.");
  }

  for (const variable of ["DATABASE_URL", "DIRECT_URL"] as const) {
    const value = environment[variable];
    if (!value) throw new Error(variable + " is required for Supabase integration tests.");
    if (projectRefFromDatabaseUrl(value, variable) !== expectedRef) {
      throw new Error(variable + " does not match SUPABASE_INTEGRATION_PROJECT_REF.");
    }
  }
}
