const baseConfig = require("./jest.config.cjs");

module.exports = {
  ...baseConfig,
  testMatch: ["<rootDir>/test/integration/postgres/*.test.ts"],
  testPathIgnorePatterns: [],
  // Prisma loads its query compiler and WASM payload as ESM from node_modules.
  // Transform only those runtime modules for Jest's CommonJS execution mode.
  transformIgnorePatterns: ["/node_modules/(?!@prisma/client/runtime/)"],
  transform: {
    ...baseConfig.transform,
    "^.+\\.mjs$": [
      "@swc/jest",
      {
        jsc: { parser: { syntax: "ecmascript" }, target: "es2022" },
        module: { type: "commonjs" },
      },
    ],
  },
};
