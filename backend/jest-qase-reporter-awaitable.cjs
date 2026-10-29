const JestQaseReporter = require("jest-qase-reporter");
const { trackQaseResults } = require("./qase-result-guard.cjs");

// Jest awaits promises returned by onRunComplete. The upstream reporter currently
// starts publishing there without returning its promise, so Jest can finish before
// Qase receives the final request to complete the run. Use composition so the
// awaitable hook does not override the upstream reporter's void-typed hook.
class AwaitableJestQaseReporter {
  constructor(...args) {
    this.reporter = new JestQaseReporter(...args);
    this.pendingResults = new Set();
    this.lastError = undefined;
    trackQaseResults(this.reporter.reporter, this.pendingResults, error => {
      this.lastError = error instanceof Error ? error : new Error("Qase rejected a test result.");
    });
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
    await Promise.allSettled(this.pendingResults);
    await this.reporter.onRunnerEnd();
    const unsentResults = this.reporter.reporter.getResults();
    const fallback = this.reporter.reporter.fallback;
    if (fallback?.isDisabled() || fallback?.isUsingFallback()) {
      this.lastError = new Error("Qase could not publish the test run and switched to its fallback reporter.");
    } else if (unsentResults.length > 0) {
      this.lastError = new Error(`Qase did not accept ${unsentResults.length} test result(s); the run was left incomplete.`);
    }
  }

  getLastError() {
    return this.lastError ?? this.reporter.getLastError();
  }
}

module.exports = AwaitableJestQaseReporter;
