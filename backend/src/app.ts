import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";

import { environment } from "./config/environment.js";
import { openApiDocument } from "./config/openapi.js";
import { errorMiddleware } from "./middleware/error-middleware.js";
import { notFoundMiddleware } from "./middleware/not-found-middleware.js";
import { apiRouter } from "./route/index.js";

export const app = express();

app.disable("x-powered-by");
app.use(cors({ origin: environment.CORS_ORIGIN }));
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
