module.exports = {
  ...require("./jest.config.cjs"),
  testMatch: [
    "<rootDir>/test/integration/postgres/notification-postgres.test.ts",
    "<rootDir>/test/integration/postgres/prisma-runtime.test.ts",
  ],
  testPathIgnorePatterns: [],
};
