module.exports = {
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  testEnvironment: "node",
  reporters: process.env.QASE_MODE === "testops"
    ? [
        "default",
        ["jest-qase-reporter", {
          mode: "testops",
          testops: {
            api: { token: process.env.QASE_TESTOPS_API_TOKEN },
            project: process.env.QASE_TESTOPS_PROJECT,
            run: {
              title: process.env.QASE_TESTOPS_RUN_TITLE,
              complete: true,
            },
          },
        }],
      ]
    : ["default"],
  testMatch: ["<rootDir>/test/**/*.test.ts"],
  testPathIgnorePatterns: [
    "<rootDir>/test/integration/supabase/",
    "<rootDir>/test/integration/postgres/",
  ],
  transform: {
    "^.+\\.tsx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript" },
          target: "es2022",
        },
        module: { type: "es6" },
      },
    ],
  },
};
