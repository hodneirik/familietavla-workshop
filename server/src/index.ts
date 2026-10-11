import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createLogger } from "./core/logger.js";
import { openDb } from "./db/client.js";
import { migrate } from "./db/migrate.js";

try {
  process.loadEnvFile?.("../.env");
} catch {
  // Ingen .env-fil, bruker miljøvariabler
}

const config = loadConfig();
const log = createLogger(config.LOG_LEVEL);
const db = openDb(config.DATA_DIR);
const applied = migrate(db);
if (applied.length) log.info("Migrasjoner kjørt", { migrasjoner: applied });

const app = createApp({ config, db, log });
const server = app.listen(config.PORT, () =>
  log.info("Familietavla startet", { port: config.PORT }),
);

const shutdown = () => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
