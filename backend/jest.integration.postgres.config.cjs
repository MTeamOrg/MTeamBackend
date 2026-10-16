module.exports = {
  ...require("./jest.config.cjs"),
  // Every file in this folder, including the Prisma runtime smoke test.
  testMatch: ["<rootDir>/test/integration/postgres/**/*.test.ts"],
  testPathIgnorePatterns: [],
  // Load only the explicitly local, disposable test configuration. Never fall back to the app .env.
  setupFiles: ["<rootDir>/test/integration/postgres/load-test-environment.cjs"],
  testTimeout: 120000,
};
