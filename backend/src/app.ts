import express from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import swaggerUi from "swagger-ui-express";
import { parse } from "yaml";

export const app = express();

const openApiPath = fileURLToPath(
  new URL("../docs/openapi.yaml", import.meta.url),
);
const openApiDocument = parse(
  readFileSync(openApiPath, "utf8"),
) as Record<string, unknown>;

app.disable("x-powered-by");
app.use(express.json());

app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(openApiDocument, {
    customSiteTitle: "M-Team API",
  }),
);

app.get("/api/health", (_request, response) => {
  response.status(200).json({
    status: "ok",
    environment: process.env.APP_ENV ?? "development",
  });
});
