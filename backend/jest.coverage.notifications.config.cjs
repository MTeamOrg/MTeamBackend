// Coverage of the notification module alone (course target: 80 %).
// Run: npm run test:coverage:notifications
module.exports = {
  ...require("./jest.config.cjs"),
  coverageProvider: "v8",
  collectCoverageFrom: [
    "src/controller/notification-controller.ts",
    "src/route/notification-route.ts",
    "src/service/notification-service.ts",
    "src/repository/notification-repository.ts",
    "src/validator/notification-validator.ts",
    "src/model/notification-message.ts",
    "src/model/membership-status.ts",
  ],
  coverageThreshold: {
    global: { statements: 80, branches: 80, functions: 80, lines: 80 },
  },
};
