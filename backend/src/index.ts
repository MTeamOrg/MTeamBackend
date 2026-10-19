import { app } from "./app.js";
import { disconnectDatabase } from "./config/database.js";
import { environment } from "./config/environment.js";

const server = app.listen(environment.PORT, () => {
  console.log(`M-Team API listening on port ${environment.PORT}`);
});

async function shutDown(): Promise<void> {
  server.close(async () => {
    await disconnectDatabase();
    process.exit(0);
  });
}

process.on("SIGINT", shutDown);
process.on("SIGTERM", shutDown);
