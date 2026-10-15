// Exercise the real ESM dependencies that unit repository mocks never load.
// This test intentionally needs no database or provider credentials.
test("loads the Prisma PostgreSQL query compiler and compiles its WASM payload", async () => {
  const runtime = await import("@prisma/client/runtime/query_compiler_fast_bg.postgresql.mjs");
  const { wasm } = await import("@prisma/client/runtime/query_compiler_fast_bg.postgresql.wasm-base64.mjs");

  expect(typeof runtime.QueryCompiler).toBe("function");
  const module = await WebAssembly.compile(Buffer.from(wasm, "base64"));
  expect(module).toBeInstanceOf(WebAssembly.Module);
});
