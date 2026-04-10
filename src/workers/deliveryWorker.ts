import { Job, Worker } from "bullmq";
import { DeliveryService } from "../services/deliveryService";
import { DELIVERY_QUEUE_NAME, DeliveryJobData } from "../queue/deliveryQueue";
import { logger } from "../utils/logger";
import { redis } from "../queue/redis";
import { config } from "../config/index";


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
   logger.error(`Job ${job?.id} failed: ${e.message}`, { error: e });
});

logger.info(`Delivery worker started (concurrency=${config.delivery.concurrency})`);
