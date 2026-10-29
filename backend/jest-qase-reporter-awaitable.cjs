const JestQaseReporter = require("jest-qase-reporter");

// Jest awaits promises returned by onRunComplete. The upstream reporter currently
// starts publishing there without returning its promise, so Jest can finish before
// Qase receives the final request to complete the run. Use composition so the
// awaitable hook does not override the upstream reporter's void-typed hook.
class AwaitableJestQaseReporter {
  constructor(...args) {
    this.reporter = new JestQaseReporter(...args);
  }

  onRunStart(...args) {
    return this.reporter.onRunStart(...args);
  }

  onTestCaseStart(...args) {
    return this.reporter.onTestCaseStart(...args);
  }

  onTestCaseResult(...args) {
    return this.reporter.onTestCaseResult(...args);
  }

  onTestResult(...args) {
    return this.reporter.onTestResult(...args);
  }

  async onRunComplete() {
    this.reporter.profilerTracker.restore();
    await this.reporter.onRunnerEnd();
  }

  getLastError() {
    return this.reporter.getLastError();
  }
}

module.exports = AwaitableJestQaseReporter;
