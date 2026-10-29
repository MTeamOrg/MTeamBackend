const { createHash } = require("node:crypto");

const MAX_QASE_TITLE_LENGTH = 255;
const HASH_LENGTH = 12;

function normalizeQaseResult(result) {
  if (result.title.length <= MAX_QASE_TITLE_LENGTH) return result;

  const suffix = ` [${createHash("sha256").update(result.title).digest("hex").slice(0, HASH_LENGTH)}]`;
  const availableLength = MAX_QASE_TITLE_LENGTH - suffix.length;
  let prefix = "";
  for (const character of result.title) {
    if (prefix.length + character.length > availableLength) break;
    prefix += character;
  }

  const originalTitle = result.title;
  const message = result.message
    ? `${result.message}\n\nOriginal test title: ${originalTitle}`
    : `Original test title: ${originalTitle}`;

  return { ...result, title: `${prefix}${suffix}`, message };
}

function trackQaseResults(qaseReporter, pendingResults, onError) {
  const addTestResult = qaseReporter.addTestResult.bind(qaseReporter);
  qaseReporter.addTestResult = result => {
    const operation = Promise.resolve(addTestResult(normalizeQaseResult(result)));
    pendingResults.add(operation);
    operation.then(
      () => pendingResults.delete(operation),
      error => {
        onError(error);
        pendingResults.delete(operation);
      },
    );
    return operation;
  };
}

module.exports = { MAX_QASE_TITLE_LENGTH, normalizeQaseResult, trackQaseResults };
