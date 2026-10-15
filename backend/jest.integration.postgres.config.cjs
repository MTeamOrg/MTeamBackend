module.exports = {
  ...require("./jest.config.cjs"),
  // Every file in this folder, including the Prisma runtime smoke test.
  testMatch: ["<rootDir>/test/integration/postgres/**/*.test.ts"],
  testPathIgnorePatterns: [],
  testTimeout: 30000,
};
