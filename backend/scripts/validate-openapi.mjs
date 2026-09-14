import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import SwaggerParser from "@apidevtools/swagger-parser";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIRECTORY = path.resolve(SCRIPT_DIRECTORY, "..");
const OPENAPI_PATH = path.join(BACKEND_DIRECTORY, "docs", "openapi.yaml");
const SOURCE_DIRECTORY = path.join(BACKEND_DIRECTORY, "src");
const HTTP_METHODS = ["get", "post", "put", "patch", "delete"];
const IMPLEMENTATION_STATUSES = new Set([
  "implemented-verified",
  "implemented-unverified",
  "pending",
]);

const failures = [];
const fail = (message) => failures.push(message);

async function findTypeScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return findTypeScriptFiles(entryPath);
      return entry.isFile() && entry.name.endsWith(".ts") ? [entryPath] : [];
    }),
  );
  return nestedFiles.flat();
}

async function discoverImplementedRoutes() {
  const routes = new Set();
  const routePattern =
    /\b(?:app|\w+Router)\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/g;

  for (const file of await findTypeScriptFiles(SOURCE_DIRECTORY)) {
    if (file.endsWith(".test.ts")) continue;
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(routePattern)) {
      const method = match[1].toUpperCase();
      const routePath = match[2].replace(/^\/api(?=\/)/, "");
      routes.add(`${method} ${routePath}`);
    }
  }

  return routes;
}

function operationEntries(document) {
  const entries = [];
  for (const [routePath, pathItem] of Object.entries(document.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      if (pathItem?.[method]) {
        entries.push({ routePath, method, pathItem, operation: pathItem[method] });
      }
    }
  }
  return entries;
}

function hasSchemaExample(schema) {
  if (!schema || typeof schema !== "object") return false;
  if ("example" in schema || "examples" in schema) return true;
  return Object.values(schema.properties ?? {}).some(hasSchemaExample);
}

function validateContractRules(document, implementedRoutes) {
  const operationIds = new Set();
  const documentedImplementedRoutes = new Set();
  const tagNames = new Set((document.tags ?? []).map((tag) => tag.name));

  if (!document.servers?.some((server) => server.url.endsWith("/api"))) {
    fail("Debe existir al menos un server cuya URL termine en /api.");
  }

  for (const { routePath, method, pathItem, operation } of operationEntries(document)) {
    const label = `${method.toUpperCase()} ${routePath}`;
    const status = operation["x-implementation-status"];

    if (routePath === "/api" || routePath.startsWith("/api/")) {
      fail(`${label}: paths no debe duplicar el prefijo /api de servers.`);
    }
    if (!operation.operationId) {
      fail(`${label}: falta operationId.`);
    } else if (operationIds.has(operation.operationId)) {
      fail(`${label}: operationId duplicado (${operation.operationId}).`);
    } else {
      operationIds.add(operation.operationId);
    }
    if (!operation.summary || !operation.description) {
      fail(`${label}: summary y description son obligatorios.`);
    }
    if (!Array.isArray(operation.tags) || operation.tags.length !== 1) {
      fail(`${label}: debe declarar exactamente un tag.`);
    } else if (!tagNames.has(operation.tags[0])) {
      fail(`${label}: usa un tag no declarado (${operation.tags[0]}).`);
    }
    if (!IMPLEMENTATION_STATUSES.has(status)) {
      fail(`${label}: x-implementation-status inválido o ausente.`);
    }
    if (status === "pending") {
      if (!operation.description.includes("CONTRATO PENDIENTE")) {
        fail(`${label}: un contrato pendiente debe mostrar la advertencia visible.`);
      }
      if (!operation.description.includes("Try it out")) {
        fail(`${label}: la advertencia pendiente debe explicar Try it out.`);
      }
    } else {
      documentedImplementedRoutes.add(label);
    }

    const operationSecurity = operation.security ?? document.security;
    const isPublic = Array.isArray(operationSecurity) && operationSecurity.length === 0;
    if (!isPublic && !Array.isArray(operation["x-roles"])) {
      fail(`${label}: una operación protegida debe declarar x-roles.`);
    }

    const successResponses = Object.entries(operation.responses ?? {}).filter(
      ([statusCode]) => /^2\d\d$/.test(statusCode),
    );
    if (successResponses.length === 0) {
      fail(`${label}: falta una respuesta exitosa explícita.`);
    }
    for (const [statusCode, response] of successResponses) {
      for (const mediaType of Object.values(response.content ?? {})) {
        if (!hasSchemaExample(mediaType.schema)) {
          fail(`${label} ${statusCode}: la respuesta exitosa no contiene ejemplos.`);
        }
      }
    }

    const declaredParameters = [
      ...(pathItem.parameters ?? []),
      ...(operation.parameters ?? []),
    ];
    for (const parameterName of routePath.matchAll(/\{([^}]+)\}/g)) {
      const parameter = declaredParameters.find(
        (candidate) =>
          candidate.in === "path" && candidate.name === parameterName[1],
      );
      if (!parameter || parameter.required !== true) {
        fail(`${label}: el parámetro {${parameterName[1]}} debe declararse required.`);
      }
    }
  }

  for (const route of implementedRoutes) {
    if (!documentedImplementedRoutes.has(route)) {
      fail(`${route}: existe en Express pero no figura como implementado en OpenAPI.`);
    }
  }
  for (const route of documentedImplementedRoutes) {
    if (!implementedRoutes.has(route)) {
      fail(`${route}: figura implementado en OpenAPI pero no se encontró en Express.`);
    }
  }
}

function validateComponentExamples(document) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  for (const [name, schema] of Object.entries(document.components?.schemas ?? {})) {
    if (!("example" in schema)) continue;
    try {
      const validate = ajv.compile(schema);
      if (!validate(schema.example)) {
        fail(`components.schemas.${name}.example no coincide con su schema: ${ajv.errorsText(validate.errors)}`);
      }
    } catch (error) {
      fail(`components.schemas.${name}: no se pudo validar el ejemplo (${error.message}).`);
    }
  }
}

try {
  const parsedDocument = await SwaggerParser.validate(OPENAPI_PATH);
  const dereferencedDocument = await SwaggerParser.dereference(OPENAPI_PATH);
  const implementedRoutes = await discoverImplementedRoutes();

  validateContractRules(dereferencedDocument, implementedRoutes);
  validateComponentExamples(dereferencedDocument);

  if (failures.length > 0) {
    console.error("OpenAPI inválido:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    const operations = operationEntries(parsedDocument);
    const counts = operations.reduce((result, { operation }) => {
      const status = operation["x-implementation-status"];
      result[status] = (result[status] ?? 0) + 1;
      return result;
    }, {});
    console.log(
      `OpenAPI válido: ${operations.length} operaciones; ` +
        `${implementedRoutes.size} rutas Express; estados ${JSON.stringify(counts)}.`,
    );
  }
} catch (error) {
  console.error(`No se pudo validar OpenAPI: ${error.message}`);
  process.exitCode = 1;
}
