import "dotenv/config";

import { app } from "./app.js";

const DEFAULT_PORT = 3000;
const configuredPort = Number(process.env.PORT ?? DEFAULT_PORT);

if (!Number.isInteger(configuredPort) || configuredPort <= 0) {
  throw new Error("PORT must be a positive integer");
}

app.listen(configuredPort, () => {
  console.log(`M-Team API listening on port ${configuredPort}`);
});
