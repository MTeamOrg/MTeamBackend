// Real dependencies: catches ESM runtime failures before database assertions.
test("loads Prisma PostgreSQL query compiler and WASM runtime", async () => {
  const runtime = await import("@prisma/client/runtime/query_compiler_fast_bg.postgresql.mjs");
  const { wasm } = await import("@prisma/client/runtime/query_compiler_fast_bg.postgresql.wasm-base64.mjs");
  expect(typeof runtime.QueryCompiler).toBe("function");
  expect(await WebAssembly.compile(Buffer.from(wasm, "base64"))).toBeInstanceOf(WebAssembly.Module);
});
