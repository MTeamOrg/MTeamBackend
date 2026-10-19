const path = require("node:path");

module.exports = {
  ...require("./jest.config.cjs"),
  coverageProvider: "v8",
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/generated/**",
    "!src/**/*.d.ts",
    "!src/**/*.test.ts",
    "!src/**/*.spec.ts",
    "!src/**/__tests__/**",
  ],
  coverageDirectory: "<rootDir>/coverage",
  coverageReporters: [
    "text",
    "json-summary",
    // The scanner runs at the repository root, one directory above Jest.
    ["lcov", { projectRoot: path.resolve(__dirname, "..") }],
  ],
};
