import { Job, Worker } from "bullmq";
import { DeliveryService } from "../services/deliveryService.js";
import { DELIVERY_QUEUE_NAME, DeliveryJobData } from "../queue/deliveryQueue.js";
import { logger } from "../utils/logger.js";
import { redis } from "../queue/redis.js";
import { config } from "../config/index.js";


const deliveryService = new DeliveryService();

const worker = new Worker<DeliveryJobData>(
   DELIVERY_QUEUE_NAME,
   async (job: Job<DeliveryJobData>) => {
      logger.info(`Processing delivery job ${job.id} for deliveryId ${job.data.deliveryId}`);
      await deliveryService.attemptDelivery(job.data.deliveryId, job.attemptsMade + 1);
   },
   {
      connection: redis,
      concurrency: config.delivery.concurrency
   }
);

worker.on("completed", (job) => {
   logger.info(`Job ${job.id} completed`);
});

worker.on("failed", (job, e) => {
   logger.info(`Job ${job?.id} failed`);
});

logger.info(`Delivery worker started (concurrency=${config.delivery.concurrency})`);
