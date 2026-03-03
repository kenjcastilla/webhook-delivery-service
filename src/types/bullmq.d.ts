import 'bullmq';
import type { Redis, RedisOptions, ClusterOptions } from 'ioredis';

/**
 * Augmented BullMQ module declarations due to issues with Redis implementation in BullMQ 'Queue' class.
 */
declare module 'bullmq' {
   interface QueueOptions {
      connection?: Redis | RedisOptions | ClusterOptions;
   }

   interface WorkerOptions {
      connection?: Redis | RedisOptions | ClusterOptions;
   }
}
