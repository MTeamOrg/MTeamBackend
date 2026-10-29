import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const backendDirectory = dirname(scriptDirectory);
const routeDirectory = join(backendDirectory, "src", "route");
const openApiPath = join(backendDirectory, "docs", "openapi.yaml");
const appSource = readFileSync(join(backendDirectory, "src", "app.ts"), "utf8");

if (!appSource.includes('app.use("/api", apiRouter)')) {
  throw new Error("Expected the API router to be mounted under /api in src/app.ts");
}

const document = parse(readFileSync(openApiPath, "utf8"));
const serverPath = new URL(document.servers?.[0]?.url ?? "http://invalid").pathname
  .replace(/\/$/, "");
if (serverPath !== "/api") {
  throw new Error("Expected the OpenAPI server path to be /api, got " + (serverPath || "/"));
}

const normalizePath = (path) => path
  .replace(/:([A-Za-z0-9_]+)/g, "{$1}")
  .replace(/\/$/, "") || "/";

const routeOperations = new Set();
const routePattern = /\b(?:router|[A-Za-z_$][\w$]*Router)\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']/g;
for (const fileName of readdirSync(routeDirectory)) {
  if (!fileName.endsWith(".ts") || fileName === "index.ts") continue;
  const source = readFileSync(join(routeDirectory, fileName), "utf8");
  for (const match of source.matchAll(routePattern)) {
    routeOperations.add(match[1].toUpperCase() + " " + normalizePath(match[2]));
  }
}

const openApiOperations = new Set();
const operationIds = new Map();
const httpMethods = new Set(["get", "post", "put", "patch", "delete"]);
for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
  for (const [method, operation] of Object.entries(pathItem ?? {})) {
    if (httpMethods.has(method) && operation) {
      openApiOperations.add(method.toUpperCase() + " " + normalizePath(path));
      if (operation.operationId) {
        const previous = operationIds.get(operation.operationId);
        if (previous) {
          throw new Error(
            "Duplicate OpenAPI operationId " + operation.operationId
              + " at " + previous + " and " + method.toUpperCase() + " " + path,
          );
        }
        operationIds.set(operation.operationId, method.toUpperCase() + " " + path);
      }
    }
  }
}

const documentedWithoutRoute = [...openApiOperations]
  .filter((operation) => !routeOperations.has(operation))
  .sort();
const routeWithoutDocumentation = [...routeOperations]
  .filter((operation) => !openApiOperations.has(operation))
  .sort();

if (documentedWithoutRoute.length || routeWithoutDocumentation.length) {
  const report = [
    "OpenAPI/Express route mismatch",
    "Documented without route: " + (documentedWithoutRoute.join(", ") || "none"),
    "Route without documentation: " + (routeWithoutDocumentation.join(", ") || "none"),
  ].join("\n");
  throw new Error(report);
}

console.log("OpenAPI/Express route correspondence passed (" + routeOperations.size + " operations)");
