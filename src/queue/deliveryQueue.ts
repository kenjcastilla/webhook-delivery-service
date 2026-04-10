import { Queue } from "bullmq";
import { redis } from "./redis";
import { config } from "../config/index";

export const DELIVERY_QUEUE_NAME = 'webhook-deliveries';

export type DeliveryJobData = {
   deliveryId: string;
}

export const deliveryQueue = new Queue<DeliveryJobData>(DELIVERY_QUEUE_NAME, {
   connection: redis,
   defaultJobOptions: {
      attempts: config.delivery.maxAttempts,
      backoff: {
         type: 'exponential',
         delay: 5000, // 5s, 10s, 20s, 40s, 80s
      },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 1000 * config.delivery.maxAttempts },
   },
});