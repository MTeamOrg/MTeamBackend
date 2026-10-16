export function supabaseStorageAuthHeaders(apiKey: string): Record<string, string> {
  const headers = { apikey: apiKey };
  // Supabase secret API keys are not JWTs and must not be sent as Bearer tokens.
  if (!apiKey.startsWith("sb_secret_")) {
    return { ...headers, authorization: "Bearer " + apiKey };
  }
  return headers;
}
