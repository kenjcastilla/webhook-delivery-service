import { createApp } from "./api/app.js";
import { config } from "./config/index.js";
import { db } from "./db/index.js";
import { redis } from "./queue/redis.js";
import { logger } from "./utils/logger.js";

async function main() {
   // Verify database and Redis connections on startup
   await db.$connect();
   logger.info("PostgreSQL db connected");

   await redis.ping();
   logger.info("Redis connected");

   const app = createApp();

   app.listen(config.port, () => {
      logger.info(`The webhook service is running on port ${config.port} [${config.nodeEnv}]`);
   });
}

main().catch((e) => {
   logger.error("Server startup failed", e);
   process.exit(1)
});