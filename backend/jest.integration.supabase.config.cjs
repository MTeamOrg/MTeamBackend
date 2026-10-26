module.exports = {
  ...require("./jest.config.cjs"),
  testMatch: ["<rootDir>/test/integration/supabase/**/*.integration.ts"],
  testPathIgnorePatterns: [],
  testTimeout: 120000,
};
