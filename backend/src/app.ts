import express from "express";
import swaggerUi from "swagger-ui-express";

import { openApiDocument } from "./config/openapi.js";
import { errorMiddleware } from "./middleware/error-middleware.js";
import { notFoundMiddleware } from "./middleware/not-found-middleware.js";
import { apiRouter } from "./route/index.js";

export const app = express();

app.disable("x-powered-by");
app.use(express.json());

app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(openApiDocument, {
    customSiteTitle: "M-Team API",
  }),
);

app.use("/api", apiRouter);
app.use(notFoundMiddleware);
app.use(errorMiddleware);
