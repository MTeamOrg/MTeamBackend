const { MAX_QASE_TITLE_LENGTH, normalizeQaseResult, trackQaseResults } = require("../qase-result-guard.cjs") as {
  MAX_QASE_TITLE_LENGTH: number;
  normalizeQaseResult: (result: { title: string; message: string | null }) => { title: string; message: string | null };
  trackQaseResults: (
    reporter: { addTestResult: (result: { title: string; message: string | null }) => Promise<void> },
    pending: Set<Promise<void>>,
    onError: (error: unknown) => void,
  ) => void;
};

describe("Qase result guard", () => {
  it("preserves short titles unchanged", () => {
    const result = { title: "login succeeds", message: null };

    expect(normalizeQaseResult(result)).toBe(result);
  });

  it("preserves an existing message when shortening a long title", () => {
    const originalTitle = "long test title ".repeat(20);
    const result = { title: originalTitle, message: null };

    expect(normalizeQaseResult(result).message).toBe(`Original test title: ${originalTitle}`);
  });

  it("shortens long titles deterministically and retains the original title in the message", () => {
    const originalTitle = `${"flujo de acceso ".repeat(30)}✅`;
    const result = { title: originalTitle, message: "Assertion details" };

    const normalized = normalizeQaseResult(result);

    expect(normalized.title).toHaveLength(MAX_QASE_TITLE_LENGTH);
    expect(normalized.title).toBe(normalizeQaseResult(result).title);
    expect(normalized.title).not.toBe(originalTitle);
    expect(normalized.message).toContain("Assertion details");
    expect(normalized.message).toContain(originalTitle);
  });

  it("tracks result uploads and observes rejected promises", async () => {
    const failure = new Error("Qase upload failed");
    const onError = jest.fn();
    const pending = new Set<Promise<void>>();
    const reporter = { addTestResult: jest.fn(async () => { throw failure; }) };
    trackQaseResults(reporter, pending, onError);

    const result = reporter.addTestResult({ title: "test", message: null });
    await Promise.allSettled([result]);

    expect(onError).toHaveBeenCalledWith(failure);
    expect(pending.size).toBe(0);
  });

  it("removes successful uploads from the pending set", async () => {
    const onError = jest.fn();
    const pending = new Set<Promise<void>>();
    const reporter = { addTestResult: jest.fn(async () => undefined) };
    trackQaseResults(reporter, pending, onError);

    await reporter.addTestResult({ title: "test", message: null });

    expect(onError).not.toHaveBeenCalled();
    expect(pending.size).toBe(0);
  });
});
