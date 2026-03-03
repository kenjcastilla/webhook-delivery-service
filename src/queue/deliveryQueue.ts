import { Queue } from "bullmq";
import { redis } from "./redis.js";

export const DELIVERY_QUEUE_NAME = 'webhook-deliveries';

export type DeliveryJobData = {
   deliveryId: string;
}

export const deliveryQueue = new Queue<DeliveryJobData>(DELIVERY_QUEUE_NAME, {
   connection: redis,
   defaultJobOptions: {
      attempts: 5,
      backoff: {
         type: 'exponential',
         delay: 5000, //5s, 10s, 20s, 40s, 80s
      },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
   },
});