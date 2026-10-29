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
      reporter: {
        profilerTracker: { restore: () => void };
        onRunnerEnd: () => Promise<void>;
      };
      onRunComplete: () => Promise<void>;
    };
    reporter.reporter = {
      profilerTracker: { restore: () => calls.push("restore") },
      onRunnerEnd: () => new Promise<void>((resolve) => {
        finishPublishing = () => {
          calls.push("published");
          resolve();
        };
      }),
    };

    const completion = reporter.onRunComplete();

    expect(calls).toEqual(["restore"]);
    finishPublishing();
    await completion;
    expect(calls).toEqual(["restore", "published"]);
  });
});
