#!/usr/bin/env node

import { readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIRECTORY = path.resolve(SCRIPT_DIRECTORY, "..");
const REPOSITORY_DIRECTORY = path.resolve(BACKEND_DIRECTORY, "..");
const DEFAULT_MANIFEST = path.join(BACKEND_DIRECTORY, "docs", "qase-test-case-manifest.json");
const DEFAULT_PREVIEW = path.join(BACKEND_DIRECTORY, "docs", "qase-test-documentation-preview.json");
const DEFAULT_REPORT = path.join(BACKEND_DIRECTORY, "docs", "qase-test-documentation-report.md");
const QASE_API_BASE_URL = "https://api.qase.io/v1";
const DOCUMENTED_FIELDS = ["description", "preconditions", "postconditions", "steps"];
const SENSITIVE_NAME_PATTERN = /password|passwd|token|secret|jwt|api[_-]?key|authorization|bearer/i;
const SENSITIVE_VALUE_PATTERN = /password|passwd|token|secret|jwt|api[_-]?key|service[-_ ]?role[-_ ]?key|app[-_ ]?password/i;
const REQUIREMENT_PATTERN = /\b[A-Z]{2,6}-\d{1,3}\b/g;

const options = parseArguments(process.argv.slice(2));

if (options.write && !options.confirmWrite) {
  fail("Las escrituras requieren --write y --confirm-qase-write. La vista previa es el modo predeterminado.");
}

if (options.write && !options.allowMassUpdate && options.sample > 5) {
  fail("La escritura inicial está limitada a una muestra de hasta 5 casos. Revisá el dry-run y usá --allow-mass-update solo con autorización explícita.");
}

const manifest = await loadManifest(options.manifest);
const testFiles = await findTestFiles(path.join(BACKEND_DIRECTORY, "test"));
const analyzedTests = [];

for (const filePath of testFiles) {
  const source = await readFile(filePath, "utf8");
  analyzedTests.push(...analyzeTestFile(filePath, source));
}

const tests = markAmbiguousTests(analyzedTests);
const manifestResolution = resolveManifest(manifest, tests);
let remoteCases = [];
let qaseStatus = "not-configured";
let qaseError = null;

if (process.env.QASE_TESTOPS_API_TOKEN && process.env.QASE_TESTOPS_PROJECT) {
  try {
    remoteCases = await fetchAllCases(process.env.QASE_TESTOPS_PROJECT, process.env.QASE_TESTOPS_API_TOKEN);
    qaseStatus = "read-only";
  } catch (error) {
    qaseStatus = "error";
    qaseError = error instanceof Error ? error.message : "Error desconocido al consultar Qase";
    if (options.write) fail(`No se pudo consultar Qase antes de escribir: ${qaseError}`);
  }
} else if (options.write) {
  fail("--write requiere QASE_TESTOPS_API_TOKEN y QASE_TESTOPS_PROJECT.");
}

const resolvedCases = resolveQaseCases(tests, manifestResolution, remoteCases, process.env.QASE_TESTOPS_PROJECT ?? manifest.project ?? "PROJECT");
const documents = tests.map(test => buildDocument(test, resolvedCases.get(test.locator) ?? null));
const selectedLocators = selectValidationSample(documents, options.sample).map(document => document.locator);
const writeCandidates = documents.filter(document =>
  document.qase.matchStatus === "manifest" &&
  selectedLocators.includes(document.locator) &&
  document.ambiguity.length === 0,
);

const writeResults = options.write
  ? await writeDocuments(writeCandidates, remoteCases, process.env.QASE_TESTOPS_PROJECT, process.env.QASE_TESTOPS_API_TOKEN, manifest)
  : [];

const summary = buildSummary({
  branch: process.env.GIT_BRANCH ?? null,
  tests,
  documents,
  manifestResolution,
  remoteCases,
  qaseStatus,
  qaseError,
  selectedLocators,
  writeResults,
  options,
});

await writeJson(options.output, {
  schemaVersion: 1,
  generatedBy: "backend/scripts/qase-documentation-sync.mjs",
  mode: options.write ? "write" : "dry-run",
  qase: {
    project: process.env.QASE_TESTOPS_PROJECT ?? manifest.project ?? null,
    status: qaseStatus,
    remoteCaseCount: remoteCases.length,
    writeCount: writeResults.filter(result => result.status === "updated").length,
  },
  summary,
  tests: documents,
});
await writeFile(options.report, buildReport(summary, documents), "utf8");

process.stdout.write(`${JSON.stringify({
  mode: options.write ? "write" : "dry-run",
  analyzedTests: summary.analyzedTests,
  proposedDocuments: summary.proposedDocuments,
  linkedByManifest: summary.linkedByManifest,
  ambiguous: summary.ambiguous,
  qaseStatus,
  preview: path.relative(REPOSITORY_DIRECTORY, options.output),
  report: path.relative(REPOSITORY_DIRECTORY, options.report),
}, null, 2)}\n`);

function parseArguments(argumentsList) {
  const parsed = {
    write: false,
    confirmWrite: false,
    allowMassUpdate: false,
    sample: 5,
    manifest: DEFAULT_MANIFEST,
    output: DEFAULT_PREVIEW,
    report: DEFAULT_REPORT,
  };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--write") parsed.write = true;
    else if (argument === "--dry-run") parsed.write = false;
    else if (argument === "--confirm-qase-write") parsed.confirmWrite = true;
    else if (argument === "--allow-mass-update") parsed.allowMassUpdate = true;
    else if (argument === "--sample") parsed.sample = parsePositiveInteger(argumentsList[++index], "--sample");
    else if (argument === "--manifest") parsed.manifest = path.resolve(argumentsList[++index]);
    else if (argument === "--output") parsed.output = path.resolve(argumentsList[++index]);
    else if (argument === "--report") parsed.report = path.resolve(argumentsList[++index]);
    else if (argument === "--help" || argument === "-h") printHelpAndExit();
    else fail(`Argumento desconocido: ${argument}`);
  }

  return parsed;
}

function parsePositiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) fail(`${flag} debe ser un entero positivo.`);
  return parsed;
}

function printHelpAndExit() {
  process.stdout.write(`Uso:\n  node scripts/qase-documentation-sync.mjs [--dry-run] [--sample 5]\n\nOpciones seguras:\n  --dry-run                    Analiza y genera la vista previa; es el modo predeterminado.\n  --sample N                   Marca N casos para revisión inicial (predeterminado: 5).\n  --manifest PATH              Manifiesto de IDs Qase explícitos.\n  --output PATH                JSON de vista previa.\n  --report PATH                Informe Markdown resumido.\n\nEscritura remota explícita:\n  --write --confirm-qase-write Actualiza solo IDs del manifiesto y campos vacíos.\n  --allow-mass-update           Quita el límite de cinco casos; requiere autorización explícita.\n`);
  process.exit(0);
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

async function loadManifest(manifestPath) {
  if (!existsSync(manifestPath)) return { version: 1, project: null, cases: [] };
  try {
    const parsed = JSON.parse(await readFile(manifestPath, "utf8"));
    if (!Array.isArray(parsed.cases)) fail(`El manifiesto ${manifestPath} debe contener una propiedad cases de tipo array.`);
    return parsed;
  } catch (error) {
    fail(`No se pudo leer el manifiesto ${manifestPath}: ${error instanceof Error ? error.message : "JSON inválido"}`);
  }
}

async function findTestFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await findTestFiles(entryPath));
    else if (entry.isFile() && entry.name.endsWith(".test.ts")) files.push(entryPath);
  }
  return files.sort();
}

function analyzeTestFile(filePath, source) {
  const declarations = scanDeclarations(source);
  const tests = declarations.filter(declaration => declaration.kind === "test");
  const relativeFile = toRepositoryPath(filePath);

  return tests.map((testDeclaration, index) => {
    const containingDescribes = declarations
      .filter(declaration => declaration.kind === "describe" && declaration.bodyStart <= testDeclaration.start && declaration.bodyEnd >= testDeclaration.end)
      .sort((left, right) => left.bodyStart - right.bodyStart);
    const describePath = containingDescribes.map(describe => describe.title).filter(Boolean);
    const body = source.slice(testDeclaration.bodyStart + 1, testDeclaration.bodyEnd);
    const hooks = collectHooks(source, containingDescribes, testDeclaration.start);
    const assertions = collectAssertions(body);
    const actions = collectActions(body);
    const fixtures = collectFixtures(body);
    const requirements = unique([
      ...collectRequirements(testDeclaration.title),
      ...collectRequirements(describePath.join(" ")),
    ]);
    const classification = classifyTest(relativeFile, testDeclaration.title, describePath.join(" "), body);
    const locator = `${relativeFile}#${[...describePath, testDeclaration.title].filter(Boolean).join(" > ")}`;

    return {
      source: {
        file: relativeFile,
        line: lineNumberAt(source, testDeclaration.start),
        describe: describePath,
      },
      index,
      title: testDeclaration.title,
      locator,
      parameterized: testDeclaration.parameterized,
      qaseIdInCode: testDeclaration.qaseIds,
      classification,
      requirements,
      hooks,
      fixtures,
      actions,
      assertions,
      bodyHasCleanup: /\b(?:cleanup|disconnect|deleteMany|rollback|remove|unlink|close)\s*\(/i.test(body),
      body,
    };
  });
}

function scanDeclarations(source) {
  const declarations = [];
  for (let cursor = 0; cursor < source.length;) {
    if (source[cursor] === "'" || source[cursor] === '"' || source[cursor] === "`") {
      cursor = skipString(source, cursor);
      continue;
    }
    if (source[cursor] === "/" && source[cursor + 1] === "/") {
      cursor = skipLineComment(source, cursor);
      continue;
    }
    if (source[cursor] === "/" && source[cursor + 1] === "*") {
      cursor = skipBlockComment(source, cursor);
      continue;
    }

    const match = source.slice(cursor).match(/^(describe|test|it)((?:\.(?:each|skip|only|concurrent))*)/);
    if (!match || !isIdentifierBoundary(source, cursor - 1) || !isIdentifierBoundary(source, cursor + match[0].length)) {
      cursor += 1;
      continue;
    }

    const kind = match[1] === "describe" ? "describe" : "test";
    const modifiers = match[2].split(".").filter(Boolean);
    let open = skipWhitespace(source, cursor + match[0].length);
    if (source[open] !== "(") {
      cursor += match[0].length;
      continue;
    }
    let titleOpen = open;
    if (modifiers.includes("each")) {
      const dataClose = findMatching(source, open, "(", ")");
      if (dataClose < 0) {
        cursor = open + 1;
        continue;
      }
      titleOpen = skipWhitespace(source, dataClose + 1);
      if (source[titleOpen] !== "(") {
        cursor = dataClose + 1;
        continue;
      }
    }
    const callEnd = findMatching(source, titleOpen, "(", ")");
    if (callEnd < 0) {
      cursor = titleOpen + 1;
      continue;
    }
    const firstArgumentEnd = findFirstArgumentEnd(source, titleOpen + 1, callEnd);
    const firstArgument = source.slice(titleOpen + 1, firstArgumentEnd);
    const titleInfo = parseTestTitle(firstArgument, source, titleOpen + 1);
    const bodyStart = findCallbackBodyStart(source, firstArgumentEnd + 1);
    if (bodyStart < 0) {
      cursor = callEnd + 1;
      continue;
    }
    const bodyEnd = findMatching(source, bodyStart, "{", "}");
    if (bodyEnd < 0) {
      cursor = bodyStart + 1;
      continue;
    }
    declarations.push({
      kind,
      start: cursor,
      end: bodyEnd + 1,
      bodyStart,
      bodyEnd,
      title: titleInfo.title,
      qaseIds: titleInfo.qaseIds,
      parameterized: modifiers.includes("each"),
    });
    cursor += match[0].length;
  }
  return declarations;
}

function findFirstArgumentEnd(source, start, callEnd) {
  let cursor = start;
  let depth = 0;
  while (cursor < callEnd) {
    const character = source[cursor];
    if (character === "'" || character === '"' || character === "`") {
      cursor = skipString(source, cursor);
      continue;
    }
    if (character === "(" || character === "[" || character === "{") depth += 1;
    else if (character === ")" || character === "]" || character === "}") depth -= 1;
    else if (character === "," && depth === 0) return cursor;
    cursor += 1;
  }
  return callEnd;
}

function parseTestTitle(argument, source, argumentStart) {
  const trimmed = argument.trim();
  const offset = argumentStart + argument.indexOf(trimmed);
  if (trimmed.startsWith("qase(")) {
    const qaseClose = findMatching(trimmed, 4, "(", ")");
    const qaseArguments = qaseClose >= 0 ? trimmed.slice(5, qaseClose) : trimmed.slice(5);
    const values = splitTopLevelArguments(qaseArguments);
    const ids = parseQaseIds(values[0]);
    const title = values[1] ? parseLiteral(values[1].trim()) : null;
    return { title: title ?? "Test vinculado a Qase", qaseIds: ids };
  }
  const literal = parseLiteral(trimmed);
  if (literal !== null) return { title: literal, qaseIds: [] };
  const qaseIds = [...trimmed.matchAll(/\bqase\s*\(\s*(\d+)/gi)].map(match => Number(match[1]));
  return { title: sanitizeText(trimmed) || `Test dinámico en línea ${lineNumberAt(source, offset)}`, qaseIds };
}

function parseLiteral(value) {
  const trimmed = value.trim();
  if (!/^['"`]/.test(trimmed)) return null;
  const quote = trimmed[0];
  if (trimmed[trimmed.length - 1] !== quote) return null;
  const content = trimmed.slice(1, -1);
  if (quote === "`" && /\$\{/.test(content)) return sanitizeText(content.replace(/\$\{[^}]+\}/g, "{valor}"));
  return content.replace(/\\([\\'"`])/g, "$1").replace(/\\n/g, " ");
}

function parseQaseIds(value) {
  if (!value) return [];
  return [...value.matchAll(/\d+/g)].map(match => Number(match[0])).filter(Number.isSafeInteger);
}

function splitTopLevelArguments(value) {
  const argumentsList = [];
  let start = 0;
  let depth = 0;
  for (let cursor = 0; cursor < value.length; cursor += 1) {
    if (value[cursor] === "'" || value[cursor] === '"' || value[cursor] === "`") {
      cursor = skipString(value, cursor) - 1;
      continue;
    }
    if ("([{<".includes(value[cursor])) depth += 1;
    else if (")]} >".replace(/ /g, "").includes(value[cursor])) depth -= 1;
    else if (value[cursor] === "," && depth === 0) {
      argumentsList.push(value.slice(start, cursor).trim());
      start = cursor + 1;
    }
  }
  argumentsList.push(value.slice(start).trim());
  return argumentsList;
}

function findCallbackBodyStart(source, start) {
  let cursor = start;
  while (cursor < source.length) {
    if (source[cursor] === "'" || source[cursor] === '"' || source[cursor] === "`") {
      cursor = skipString(source, cursor);
      continue;
    }
    if (source[cursor] === "=" && source[cursor + 1] === ">") {
      const brace = skipWhitespace(source, cursor + 2);
      return source[brace] === "{" ? brace : -1;
    }
    if (source[cursor] === "{" && /\bfunction\b/.test(source.slice(start, cursor))) return cursor;
    if (source[cursor] === ";" || source[cursor] === "\n" && /\b(?:test|describe|it)\b/.test(source.slice(start, cursor))) return -1;
    cursor += 1;
  }
  return -1;
}

function findMatching(source, openIndex, openCharacter, closeCharacter) {
  let depth = 0;
  for (let cursor = openIndex; cursor < source.length; cursor += 1) {
    if (source[cursor] === "'" || source[cursor] === '"' || source[cursor] === "`") {
      cursor = skipString(source, cursor) - 1;
      continue;
    }
    if (source[cursor] === "/" && source[cursor + 1] === "/") {
      cursor = skipLineComment(source, cursor) - 1;
      continue;
    }
    if (source[cursor] === "/" && source[cursor + 1] === "*") {
      cursor = skipBlockComment(source, cursor) - 1;
      continue;
    }
    if (source[cursor] === openCharacter) depth += 1;
    else if (source[cursor] === closeCharacter) {
      depth -= 1;
      if (depth === 0) return cursor;
    }
  }
  return -1;
}

function skipString(source, start) {
  const quote = source[start];
  for (let cursor = start + 1; cursor < source.length; cursor += 1) {
    if (source[cursor] === "\\") {
      cursor += 1;
      continue;
    }
    if (source[cursor] === quote) return cursor + 1;
  }
  return source.length;
}

function skipLineComment(source, start) {
  const newline = source.indexOf("\n", start + 2);
  return newline < 0 ? source.length : newline + 1;
}

function skipBlockComment(source, start) {
  const end = source.indexOf("*/", start + 2);
  return end < 0 ? source.length : end + 2;
}

function skipWhitespace(source, start) {
  let cursor = start;
  while (/\s/.test(source[cursor] ?? "")) cursor += 1;
  return cursor;
}

function isIdentifierBoundary(source, index) {
  return index < 0 || !/[A-Za-z0-9_$]/.test(source[index]);
}

function collectHooks(source, describes, testStart) {
  const hookNames = ["beforeAll", "beforeEach", "afterEach", "afterAll"];
  const hooks = [];
  for (const describe of describes) {
    const segment = source.slice(describe.bodyStart, testStart);
    for (const hookName of hookNames) {
      if (new RegExp(`\\b${hookName}\\s*\\(`).test(segment)) hooks.push(hookName);
    }
  }
  return unique(hooks);
}

function collectAssertions(body) {
  const assertions = [];
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.includes("expect(")) continue;
    assertions.push(sanitizeSource(trimmed));
  }
  return unique(assertions).slice(0, 20);
}

function collectActions(body) {
  const actions = [];
  const requestPattern = /request\([^)]*\)\s*\.(get|post|put|patch|delete)\(\s*(["'`])([^"'`]+)\2\s*\)/g;
  for (const match of body.matchAll(requestPattern)) {
    const method = match[1].toUpperCase();
    const pathValue = sanitizeText(match[3]);
    const suffix = body.slice(match.index + match[0].length, match.index + match[0].length + 180);
    actions.push(`Enviar una solicitud HTTP ${method} a ${pathValue}${/\.send\s*\(/.test(suffix) ? " con el payload sintético declarado" : ""}.`);
  }
  for (const match of body.matchAll(/\b(?:await\s+)?(fixtures|service|repository|controller|database|app|client|tokenVerifier|passwords|mail)\.([A-Za-z_$][\w$]*)\s*\(/g)) {
    const action = match[1] === "fixtures"
      ? `Preparar el fixture ${match[2]}.`
      : `Invocar ${match[1]}.${match[2]}().`;
    actions.push(sanitizeSource(action));
  }
  if (/\bnew\s+[A-Z][A-Za-z0-9_$]*/.test(body)) actions.push("Instanciar la unidad bajo prueba con las dependencias declaradas.");
  if (actions.length === 0) actions.push("Ejecutar la función o regla de dominio con los datos sintéticos declarados en el test.");
  return unique(actions).slice(0, 12);
}

function collectFixtures(body) {
  const fixtures = [];
  for (const match of body.matchAll(/\bfixtures\.([A-Za-z_$][\w$]*)\s*\(/g)) fixtures.push(match[1]);
  if (/jest\.fn\s*\(|mockResolvedValue|mockRejectedValue|jest\.mock\s*\(/.test(body)) fixtures.push("mocks Jest");
  if (/\b(?:const|let)\s+\w+\s*=\s*\{/.test(body)) fixtures.push("datos sintéticos locales");
  return unique(fixtures);
}

function classifyTest(file, title, describe, body) {
  const fileLower = file.toLowerCase();
  const titleAndDescribe = `${title} ${describe}`.toLowerCase();
  if (file.includes("/integration/")) return "integration";
  if (fileLower.includes("/middleware/") || /(auth|login|password|authorization|access-attempt|account-recovery|temporary-password-reset|token-service|cors)/i.test(fileLower)) return "security";
  if (/(authorization|authentication|\bauth\b|login|password|permission|role|forbidden|unauthorized|security)/i.test(titleAndDescribe)) return "security";
  if (file.includes("/route/")) return "api";
  return "unit";
}

function collectRequirements(value) {
  return value.match(REQUIREMENT_PATTERN) ?? [];
}

function markAmbiguousTests(tests) {
  const counts = new Map();
  for (const test of tests) counts.set(test.locator, (counts.get(test.locator) ?? 0) + 1);
  return tests.map(test => ({
    ...test,
    ambiguity: counts.get(test.locator) > 1 ? ["El localizador de test no es único."] : [],
  }));
}

function resolveManifest(manifest, tests) {
  const byLocator = new Map(tests.map(test => [test.locator, test]));
  const byQaseId = new Map();
  const conflicts = [];
  const entries = [];
  const resolvedLocators = new Set();

  const addEntry = (entry, source) => {
    const qaseId = Number(entry.qaseId);
    if (!Number.isSafeInteger(qaseId) || qaseId < 1) {
      conflicts.push({ entry, reason: "qaseId debe ser un entero positivo." });
      return;
    }
    if (byQaseId.has(qaseId)) {
      conflicts.push({ entry, reason: `El ID Qase ${qaseId} está repetido en el manifiesto.` });
      return;
    }
    const locator = entry.locator ?? buildLocatorFromEntry(entry);
    const test = byLocator.get(locator);
    if (!test) {
      conflicts.push({ entry, reason: `No se encontró el localizador ${locator}.` });
      return;
    }
    if (test.ambiguity.length > 0) {
      conflicts.push({ entry, reason: "El localizador corresponde a más de una prueba." });
      return;
    }
    byQaseId.set(qaseId, test.locator);
    resolvedLocators.add(locator);
    entries.push({ ...entry, qaseId, locator, source });
  };

  for (const entry of manifest.cases) addEntry(entry, "manifest");
  for (const test of tests) {
    if (resolvedLocators.has(test.locator) || test.qaseIdInCode.length === 0) continue;
    if (test.qaseIdInCode.length > 1) {
      conflicts.push({ entry: { locator: test.locator, qaseId: test.qaseIdInCode }, reason: "La prueba declara más de un ID Qase; requiere revisión antes de documentar campos." });
      continue;
    }
    addEntry({ qaseId: test.qaseIdInCode[0], locator: test.locator }, "code");
  }
  return { entries, conflicts };
}

function buildLocatorFromEntry(entry) {
  return `${toRepositoryPath(entry.testFile ?? "")}#${[...(entry.describe ?? []), entry.title].filter(Boolean).join(" > ")}`;
}

function resolveQaseCases(tests, manifestResolution, remoteCases, project) {
  const remoteById = new Map(remoteCases.map(testCase => [Number(testCase.id), testCase]));
  const resolved = new Map();
  for (const entry of manifestResolution.entries) {
    const remoteCase = remoteById.get(entry.qaseId);
    if (remoteCase) resolved.set(entry.locator, {
      matchStatus: "manifest",
      matchSource: entry.source,
      project,
      qaseId: entry.qaseId,
      remote: remoteCase,
      allowedFields: entry.fields ?? DOCUMENTED_FIELDS,
    });
    else resolved.set(entry.locator, {
      matchStatus: "missing-remote-case",
      matchSource: entry.source,
      project,
      qaseId: entry.qaseId,
      allowedFields: entry.fields ?? DOCUMENTED_FIELDS,
    });
  }
  return resolved;
}

function buildDocument(test, qase) {
  const typeLabel = {
    unit: "unitaria",
    api: "API mediante Supertest",
    integration: "integración PostgreSQL",
    security: "seguridad/autorización",
  }[test.classification] ?? test.classification;
  const requirementText = test.requirements.length > 0
    ? ` El código identifica explícitamente el requisito ${test.requirements.join(", ")}.`
    : " No se asigna un requisito de la matriz porque el test no lo identifica explícitamente.";
  const assertions = test.assertions.length > 0
    ? test.assertions.map(assertion => `- \`${assertion}\``).join("\n")
    : "- El test no contiene una aserción Jest detectable; requiere revisión humana.";
  const hooksText = test.hooks.length > 0 ? ` Hooks observados: ${test.hooks.join(", ")}.` : "";
  const fixtureText = test.fixtures.length > 0 ? ` Usa ${test.fixtures.join(", ")}.` : "";

  return {
    locator: test.locator,
    qase: qase ? {
      matchStatus: qase.matchStatus,
      matchSource: qase.matchSource,
      qaseId: qase.qaseId,
      caseCode: qase.qaseId ? `${qase.project}-${qase.qaseId}` : null,
      currentFields: qase.remote ? {
        description: isBlank(qase.remote.description) ? "empty" : "filled",
        preconditions: isBlank(qase.remote.preconditions) ? "empty" : "filled",
        postconditions: isBlank(qase.remote.postconditions) ? "empty" : "filled",
        steps: Array.isArray(qase.remote.steps) && qase.remote.steps.length > 0 ? "filled" : "empty",
      } : null,
      allowedFields: qase.allowedFields,
    } : {
      matchStatus: "unlinked",
      qaseId: null,
      caseCode: null,
      currentFields: null,
      allowedFields: DOCUMENTED_FIELDS,
    },
    source: test.source,
    title: test.title,
    type: test.classification,
    requirements: test.requirements,
    parameterized: test.parameterized,
    ambiguity: test.ambiguity,
    manualReviewReasons: buildManualReviewReasons(test, qase),
    fields: {
      description: `Verifica «${sanitizeText(test.title)}» en la funcionalidad cubierta por el bloque ${test.source.describe.length > 0 ? `«${sanitizeText(test.source.describe.join(" > "))}»` : "de prueba"}. Es una prueba ${typeLabel} basada en el comportamiento implementado y sus aserciones.${requirementText}`,
      preconditions: buildPreconditions(test, hooksText, fixtureText),
      steps: test.actions.map((action, index) => ({
        action,
        data: test.fixtures.length > 0 && index === 0 ? "Datos sintéticos declarados por el test." : "",
        expected_result: index === test.actions.length - 1 ? "El resultado debe coincidir con las aserciones Jest documentadas a continuación." : "La operación queda disponible para el siguiente paso.",
      })),
      expectedResult: `Las verificaciones reales del test son:\n${assertions}`,
      postconditions: buildPostconditions(test),
    },
    evidence: {
      hooks: test.hooks,
      fixtures: test.fixtures,
      actions: test.actions,
      assertions: test.assertions,
      cleanupDetected: test.bodyHasCleanup,
    },
  };
}

function buildPreconditions(test, hooksText, fixtureText) {
  if (test.classification === "integration") {
    return `La prueba utiliza la configuración PostgreSQL de integración y sus fixtures persistentes.${hooksText}${fixtureText} La base de datos de prueba debe ser descartable y estar preparada por el flujo de integración.`;
  }
  if (test.classification === "api" || test.source.file.includes("/route/")) {
    return `La aplicación Express de prueba, sus rutas y los middlewares declarados en ${test.source.file} están configurados.${hooksText}${fixtureText}`;
  }
  return `Las dependencias de la unidad bajo prueba están disponibles y el estado inicial se prepara con los datos y dobles declarados en el test.${hooksText}${fixtureText}`;
}

function buildPostconditions(test) {
  const cleanup = test.hooks.filter(hook => hook.startsWith("after")).join(", ");
  if (cleanup && test.bodyHasCleanup) return `El test declara limpieza posterior mediante ${cleanup} y las operaciones de cleanup detectadas; los datos sintéticos no deben permanecer después de la ejecución.`;
  if (cleanup) return `El test declara hooks posteriores (${cleanup}); el detalle de limpieza debe revisarse en el código antes de sincronizar.`;
  if (test.bodyHasCleanup) return "El cuerpo contiene una operación de limpieza o cierre; verificar su alcance antes de sincronizar como postcondición.";
  if (test.assertions.some(assertion => /not\.toHaveBeenCalled|not\.toHaveBeenCalledTimes|not\.toBeDefined|toBeUndefined|toHaveLength\(0\)/.test(assertion))) {
    return "Las aserciones incluyen ausencia de llamadas, datos o efectos secundarios en los puntos que el test verifica.";
  }
  return "El test no declara una postcondición funcional o limpieza específica adicional.";
}

function buildManualReviewReasons(test, qase) {
  const reasons = [...test.ambiguity];
  if (!qase || qase.matchStatus === "unlinked") reasons.push("No existe un ID Qase persistido en el manifiesto ni en la declaración del test.");
  if (qase?.matchStatus === "missing-remote-case") reasons.push("El ID del manifiesto no apareció en la respuesta de Qase.");
  if (test.parameterized) reasons.push("El test es parametrizado; revisar si el caso Qase representa la plantilla o cada variante.");
  if (test.assertions.length === 0) reasons.push("No se detectó una aserción Jest.");
  return unique(reasons);
}

async function fetchAllCases(project, token) {
  const cases = [];
  let offset = 0;
  while (true) {
    const url = new URL(`${QASE_API_BASE_URL}/case/${encodeURIComponent(project)}`);
    url.searchParams.set("limit", "100");
    url.searchParams.set("offset", String(offset));
    const response = await fetch(url, { headers: { Accept: "application/json", Token: token } });
    if (!response.ok) throw new Error(`GET /case respondió HTTP ${response.status}.`);
    const payload = await response.json();
    const result = payload?.result ?? payload;
    const entities = Array.isArray(result) ? result : result?.entities ?? result?.data ?? [];
    cases.push(...entities);
    const total = Number(result?.total ?? cases.length);
    if (entities.length === 0 || cases.length >= total || entities.length < 100) break;
    offset += entities.length;
  }
  return cases;
}

async function writeDocuments(documents, remoteCases, project, token, manifest) {
  const remoteById = new Map(remoteCases.map(testCase => [Number(testCase.id), testCase]));
  const results = [];
  for (const document of documents) {
    const qaseId = document.qase.qaseId;
    const remoteCase = remoteById.get(qaseId);
    if (!remoteCase) {
      results.push({ locator: document.locator, qaseId, status: "skipped-missing-remote-case" });
      continue;
    }
    const patch = buildSafePatch(document, remoteCase, manifest);
    if (Object.keys(patch).length === 0) {
      results.push({ locator: document.locator, qaseId, status: "skipped-no-empty-authorized-fields" });
      continue;
    }
    const url = `${QASE_API_BASE_URL}/case/${encodeURIComponent(project)}/${qaseId}`;
    const response = await fetch(url, {
      method: "PATCH",
      headers: { Accept: "application/json", "Content-Type": "application/json", Token: token },
      body: JSON.stringify(patch),
    });
    if (!response.ok) {
      results.push({ locator: document.locator, qaseId, status: "error", httpStatus: response.status });
      continue;
    }
    results.push({ locator: document.locator, qaseId, status: "updated", fields: Object.keys(patch) });
  }
  return results;
}

function buildSafePatch(document, remoteCase, manifest) {
  const entry = manifest.cases.find(candidate => Number(candidate.qaseId) === document.qase.qaseId);
  const allowedFields = new Set(entry?.fields ?? DOCUMENTED_FIELDS);
  const patch = {};
  if (allowedFields.has("description") && isBlank(remoteCase.description)) patch.description = document.fields.description;
  if (allowedFields.has("preconditions") && isBlank(remoteCase.preconditions)) patch.preconditions = document.fields.preconditions;
  if (allowedFields.has("postconditions") && isBlank(remoteCase.postconditions)) patch.postconditions = document.fields.postconditions;
  if (allowedFields.has("steps") && (!Array.isArray(remoteCase.steps) || remoteCase.steps.length === 0)) {
    patch.steps_type = "classic";
    patch.steps = document.fields.steps;
  }
  return patch;
}

function selectValidationSample(documents, size) {
  const selected = [];
  const preferredPatterns = [
    /\/service\/membership-price-management\.test\.ts#/,
    /\/route\/access-attempt\.test\.ts#/,
    /\/integration\/postgres\/access-attempts-list\.postgres\.test\.ts#/,
    /\/middleware\/authorization-middleware\.test\.ts#/,
    /\/repository\/notification-triggers\.test\.ts#/,
  ];
  for (const pattern of preferredPatterns) {
    const candidate = documents.find(document => pattern.test(document.locator) && !selected.some(item => item.source.file === document.source.file));
    if (candidate) selected.push(candidate);
    if (selected.length >= size) return selected;
  }
  for (const candidate of [...documents].sort((left, right) => sampleScore(right) - sampleScore(left))) {
    if (!selected.some(item => item.source.file === candidate.source.file)) selected.push(candidate);
    if (selected.length >= size) break;
  }
  return selected.slice(0, Math.min(size, selected.length));
}

function sampleScore(document) {
  let score = 0;
  if (document.source.file.includes("membership-price-management")) score += 100;
  if (document.type === "api") score += 20;
  if (document.type === "integration") score += 15;
  if (document.type === "security") score += 10;
  if (document.qase.matchStatus === "manifest") score += 5;
  return score;
}

function buildSummary({ tests, documents, manifestResolution, remoteCases, qaseStatus, qaseError, selectedLocators, writeResults, options: runOptions }) {
  const qaseLinked = documents.filter(document => document.qase.matchStatus === "manifest");
  const ambiguous = documents.filter(document => document.ambiguity.length > 0);
  const proposed = documents.filter(document => document.manualReviewReasons.length === 0 || document.qase.matchStatus === "manifest");
  return {
    analyzedFiles: unique(tests.map(test => test.source.file)).length,
    analyzedTests: tests.length,
    proposedDocuments: documents.length,
    manifestEntries: manifestResolution.entries.length,
    linkedByManifest: qaseLinked.length,
    linkedWithRemoteCase: qaseLinked.filter(document => document.qase.matchStatus === "manifest").length,
    ambiguous: ambiguous.length,
    unlinked: documents.filter(document => document.qase.matchStatus === "unlinked").length,
    missingRemoteCases: documents.filter(document => document.qase.matchStatus === "missing-remote-case").length,
    manualReview: documents.filter(document => document.manualReviewReasons.length > 0).length,
    byType: Object.fromEntries(["unit", "api", "integration", "security"].map(type => [type, tests.filter(test => test.classification === type).length])),
    requirementsExplicitlyIdentified: unique(tests.flatMap(test => test.requirements)),
    qase: {
      status: qaseStatus,
      remoteCases: remoteCases.length,
      error: qaseError,
      manifestConflicts: manifestResolution.conflicts.length,
    },
    validationSample: selectedLocators,
    writeResults,
    mode: runOptions.write ? "write" : "dry-run",
    writeWasAttempted: runOptions.write,
  };
}

function buildReport(summary, documents) {
  const sampleDocuments = summary.validationSample
    .map(locator => documents.find(document => document.locator === locator))
    .filter(Boolean);
  const lines = [
    "# Informe de documentación de casos Qase",
    "",
    `Modo: **${summary.mode}**. La vista previa no crea ni modifica casos; el modo de escritura solo utiliza IDs explícitos del manifiesto.`,
    "",
    "## Resumen",
    "",
    `- Archivos analizados: ${summary.analyzedFiles}`,
    `- Pruebas analizadas: ${summary.analyzedTests}`,
    `- Documentaciones propuestas: ${summary.proposedDocuments}`,
    `- Casos vinculados por manifiesto: ${summary.linkedByManifest}`,
    `- Casos ambiguos: ${summary.ambiguous}`,
    `- Casos sin vínculo Qase: ${summary.unlinked}`,
    `- Casos con ID del manifiesto ausente en Qase: ${summary.missingRemoteCases}`,
    `- Casos que requieren revisión humana: ${summary.manualReview}`,
    `- Distribución: unitarias ${summary.byType.unit}, API ${summary.byType.api}, integración ${summary.byType.integration}, seguridad/autorización ${summary.byType.security}`,
    `- Estado de consulta Qase: ${summary.qase.status}; casos recibidos: ${summary.qase.remoteCases}`,
    "",
    "## Reglas de seguridad aplicadas",
    "",
    "- No se crean casos, suites ni resultados históricos.",
    "- Solo se consideran vinculaciones declaradas en `backend/docs/qase-test-case-manifest.json`.",
    "- Los campos Qase no vacíos se conservan; el PATCH solo puede completar campos vacíos autorizados.",
    "- Los casos ambiguos, sin aserciones o parametrizados quedan señalados para revisión.",
    "- El token nunca se incluye en el JSON, el informe ni los mensajes de error.",
    "",
    "## Muestra para revisión humana",
    "",
  ];
  for (const document of sampleDocuments) {
    lines.push(`### ${document.qase.caseCode ?? "Sin ID Qase"} — ${document.title}`);
    lines.push("");
    lines.push(`- Localizador: \`${document.locator}\``);
    lines.push(`- Tipo: ${document.type}; vínculo: ${document.qase.matchStatus}.`);
    lines.push(`- Revisión: ${document.manualReviewReasons.length > 0 ? document.manualReviewReasons.join(" ") : "sin observaciones automáticas"}`);
    lines.push("");
    lines.push("**Descripción propuesta**");
    lines.push("");
    lines.push(document.fields.description);
    lines.push("");
    lines.push("**Precondiciones**");
    lines.push("");
    lines.push(document.fields.preconditions);
    lines.push("");
    lines.push("**Pasos**");
    lines.push("");
    document.fields.steps.forEach((step, index) => lines.push(`${index + 1}. ${step.action} ${step.data ? `Datos: ${step.data} ` : ""}Esperado: ${step.expected_result}`));
    lines.push("");
    lines.push("**Resultado esperado**");
    lines.push("");
    lines.push(document.fields.expectedResult);
    lines.push("");
    lines.push("**Postcondiciones**");
    lines.push("");
    lines.push(document.fields.postconditions);
    lines.push("");
  }
  lines.push("## Requisitos identificados explícitamente");
  lines.push("");
  lines.push(summary.requirementsExplicitlyIdentified.length > 0 ? summary.requirementsExplicitlyIdentified.join(", ") : "Ninguno; no se inventaron asociaciones con la matriz.");
  lines.push("");
  lines.push("## Archivos de salida");
  lines.push("");
  lines.push("- `backend/docs/qase-test-documentation-preview.json`: propuesta completa y evidencia detectada.");
  lines.push("- `backend/docs/qase-test-case-manifest.json`: vínculo persistente entre un test y un ID existente de Qase.");
  return `${lines.join("\n")}\n`;
}

function isBlank(value) {
  return value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
}

function sanitizeSource(value) {
  return sanitizeText(value)
    .replace(/\b(?:Bearer|Basic)\s+[^\s,;)'\"]+/gi, "[credencial redactada]")
    .replace(/(["'`])([^"'`]*)(\1)/g, (match, quote, content) => {
      if (SENSITIVE_NAME_PATTERN.test(content) || SENSITIVE_VALUE_PATTERN.test(content) || /@/.test(content) || /^[a-f0-9]{32,}$/i.test(content) || /^[0-9a-f-]{36}$/i.test(content)) return `${quote}[dato sintético omitido]${quote}`;
      return match;
    });
}

function sanitizeText(value) {
  return String(value)
    .replace(/\b[A-Za-z0-9+/._-]{20,}\.[A-Za-z0-9+/._-]{10,}\.[A-Za-z0-9+/._-]{10,}\b/g, "[JWT omitido]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, "[id sintético]")
    .replace(/\b[A-Z0-9_]{24,}\b/g, "[secreto omitido]");
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split("\n").length;
}

function toRepositoryPath(filePath) {
  return path.relative(REPOSITORY_DIRECTORY, filePath).split(path.sep).join("/");
}

function unique(values) {
  return [...new Set(values)];
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
