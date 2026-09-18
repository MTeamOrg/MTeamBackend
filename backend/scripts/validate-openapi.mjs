import { readFileSync } from "node:fs";
import SwaggerParser from "@apidevtools/swagger-parser";
import { parse } from "yaml";

const document = parse(readFileSync(new URL("../docs/openapi.yaml", import.meta.url), "utf8"));
await SwaggerParser.validate(document);
console.log("OpenAPI validation passed");
