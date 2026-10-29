const AwaitableJestQaseReporter = require("../jest-qase-reporter-awaitable.cjs") as {
  prototype: {
    onRunComplete(this: {
      reporter: {
        profilerTracker: { restore: () => void };
        onRunnerEnd: () => Promise<void>;
      };
    }): Promise<void>;
  };
}

describe("AwaitableJestQaseReporter", () => {
  it("waits for Qase publishing and run completion before Jest finishes", async () => {
    const calls: string[] = [];
    let finishPublishing!: () => void;
    const reporter = Object.create(AwaitableJestQaseReporter.prototype) as {
      pendingResults: Set<Promise<void>>;
      lastError: Error | undefined;
      reporter: {
        profilerTracker: { restore: () => void };
        onRunnerEnd: () => Promise<void>;
        getLastError: () => undefined;
        reporter: { getResults: () => unknown[]; fallback: { isDisabled: () => false; isUsingFallback: () => false } };
      };
      onRunComplete: () => Promise<void>;
      getLastError: () => Error | undefined;
    };
    reporter.pendingResults = new Set();
    reporter.lastError = undefined;
    reporter.reporter = {
      profilerTracker: { restore: () => calls.push("restore") },
      onRunnerEnd: () => new Promise<void>((resolve) => {
        finishPublishing = () => {
          calls.push("published");
          resolve();
        };
      }),
      getLastError: () => undefined,
      reporter: { getResults: () => [], fallback: { isDisabled: () => false, isUsingFallback: () => false } },
    };

    const completion = reporter.onRunComplete();

    expect(calls).toEqual(["restore"]);
    await Promise.resolve();
    finishPublishing();
    await completion;
    expect(calls).toEqual(["restore", "published"]);
  });

  it("exposes a reporter error when Qase leaves results unsent", async () => {
    const reporter = Object.create(AwaitableJestQaseReporter.prototype) as {
      pendingResults: Set<Promise<void>>;
      lastError: Error | undefined;
      reporter: {
        profilerTracker: { restore: () => void };
        onRunnerEnd: () => Promise<void>;
        getLastError: () => undefined;
        reporter: { getResults: () => unknown[]; fallback: { isDisabled: () => false; isUsingFallback: () => false } };
      };
      onRunComplete: () => Promise<void>;
      getLastError: () => Error | undefined;
    };
    reporter.pendingResults = new Set();
    reporter.lastError = undefined;
    reporter.reporter = {
      profilerTracker: { restore: () => undefined },
      onRunnerEnd: async () => undefined,
      getLastError: () => undefined,
      reporter: { getResults: () => [{ title: "unsent" }], fallback: { isDisabled: () => false, isUsingFallback: () => false } },
    };

    await reporter.onRunComplete();

    expect(reporter.getLastError()?.message).toContain("1 test result(s)");
  });
});
