import express from "express";
import swaggerUi from "swagger-ui-express";

import { openApiDocument } from "./config/openapi.js";
import { errorMiddleware } from "./middleware/error-middleware.js";
import { notFoundMiddleware } from "./middleware/not-found-middleware.js";
import { apiRouter } from "./route/index.js";

export const app = express();

app.disable("x-powered-by");
app.use(express.json());

app.get("/api/docs/openapi.json", (_request, response) => {
  response.status(200).json(openApiDocument);
});

app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(undefined, {
    customSiteTitle: "M-Team API",
    swaggerOptions: {
      url: "/api/docs/openapi.json",
    },
  }),
);

app.use("/api", apiRouter);
app.use(notFoundMiddleware);
app.use(errorMiddleware);
