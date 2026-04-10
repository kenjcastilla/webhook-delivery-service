import { createApp } from "./api/app";
import { config } from "./config/index";
import { db } from "./db/index";
import { redis } from "./queue/redis";
import { logger } from "./utils/logger";

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