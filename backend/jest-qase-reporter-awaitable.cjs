const JestQaseReporter = require("jest-qase-reporter");

// Jest awaits promises returned by onRunComplete. The upstream reporter currently
// starts publishing there without returning its promise, so Jest can finish before
// Qase receives the final request to complete the run.
class AwaitableJestQaseReporter extends JestQaseReporter {
  async onRunComplete() {
    this.profilerTracker.restore();
    await this.onRunnerEnd();
  }
}

module.exports = AwaitableJestQaseReporter;
