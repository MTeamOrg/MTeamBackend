module.exports = {
  ...require("./jest.config.cjs"),
  testMatch: ["<rootDir>/test/integration/postgres/**/*.test.ts"],
  testPathIgnorePatterns: [],
  testTimeout: 30000,
};
