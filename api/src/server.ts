import { app } from "./app.js";
import { databasePool } from "./config/database.js";
import { env } from "./config/env.js";

const server = app.listen(env.PORT, () => {
  console.log(`Task Management API listening on port ${env.PORT}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} received; shutting down`);
  server.close(async (error) => {
    if (error) {
      console.error("Graceful shutdown failed", error);
      process.exitCode = 1;
      return;
    }

    await databasePool.end();
    process.exitCode = 0;
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
