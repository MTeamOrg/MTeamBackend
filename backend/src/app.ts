import express from "express";

export const app = express();

app.disable("x-powered-by");
app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.status(200).json({
    status: "ok",
    environment: process.env.APP_ENV ?? "development",
  });
});
