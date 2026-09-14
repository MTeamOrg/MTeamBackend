import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const openApiPath = fileURLToPath(
  new URL("../../docs/openapi.yaml", import.meta.url),
);

export const openApiDocument = parse(
  readFileSync(openApiPath, "utf8"),
) as Record<string, unknown>;
