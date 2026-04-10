import axios from "axios";
import { DeliveryService } from "../../src/services/deliveryService";
import { db } from "../../src/db";
import IORedis from "ioredis";
import { Job, Queue, Worker } from "bullmq";
import { DELIVERY_QUEUE_NAME, DeliveryJobData } from "../../src/queue/deliveryQueue";
import { DeliveryStatus } from "@prisma/client";
import { logger } from "../../src/utils/logger";

jest.mock("axios");

let testEventId: string;
let testSubscriberId: string;

// Real Redis client for integration testing
const testRedis = new IORedis({
   host: "localhost",
   port: 6380,
   maxRetriesPerRequest: null,
});

const testQueue = new Queue<DeliveryJobData>(DELIVERY_QUEUE_NAME, {
   connection: testRedis,
});

let worker: Worker<DeliveryJobData>;

async function cleanUpTestData(eventId: string, subscriberId: string) {
   await db.deliveryLog.deleteMany({
      where: {
         delivery: { eventId },
      },
   });
   await db.delivery.deleteMany(
      { where: { eventId } }
   );
   await db.event.delete({
      where: { id: eventId },
   });
   await db.subscriber.delete({
      where: { id: subscriberId },
   });
};

beforeAll(async () => {
   const service = new DeliveryService();
   worker = new Worker<DeliveryJobData>(
      DELIVERY_QUEUE_NAME,
      async (job: Job<DeliveryJobData>) => {
         await service.attemptDelivery(
            job.data.deliveryId,
            job.attemptsMade + 1,
            db // Using real DB connection 
         );
      },
      { connection: testRedis, concurrency: 1 }
   );

   await new Promise<void>((resolve) => worker.on("ready", resolve));
});

afterAll(async () => {
   await worker.close();
   await testQueue.close();
   await testRedis.quit();
});

beforeEach(async () => {
   // Clean Redis queue before each test
   await testQueue.drain();
   await testQueue.obliterate({ force: true });
});

afterEach(async () => {
   await cleanUpTestData(testEventId, testSubscriberId);
});


describe("Full Delivery Flow Integration Test", () => {
   it("should process a job and update delivery status in the database to DELIVERED", async () => {
      const subscriber = await db.subscriber.create({
         data: {
            name: "Test Subscriber",
            targetUrl: "https://example.com/webhook",
            secret: "test-secret",
            eventTypes: ["order.created"],
         }
      });

      logger.info(`Created test subscriber: ${JSON.stringify(subscriber)}`);

      const event = await db.event.create({
         data: {
            eventType: "order.created",
            payload: { orderId: "test-123" },
            deliveries: {
               create: [{
                  subscriberId: subscriber.id,
                  maxAttempts: 5,
               }],
            },
         },
         include: { deliveries: true },
      });

      testEventId = event.id;
      testSubscriberId = subscriber.id;

      const delivery = event.deliveries[0];

      if (!delivery) {
         throw new Error("Delivery record was not created");
      }

      // Mock axios
      (axios.post as jest.Mock).mockResolvedValue({
         status: 200,
         data: { received: true }
      });

      // Enqueue delivery job
      await testQueue.add("deliver", { deliveryId: delivery.id });

      // Wait for worker to process the job
      await new Promise<void>((resolve, reject) => {
         worker.on("completed", () => resolve());
         worker.on("failed", (_, e) => reject(e));
         setTimeout(() => reject(new Error("Job processing timeout")), 10000);
      });

      // Check if database was updated
      const updatedDelivery = await db.delivery.findUniqueOrThrow({
         where: { id: delivery.id },
         include: { logs: true },
      });

      logger.info(`Updated delivery logs: ${JSON.stringify(updatedDelivery.logs)}`);

      expect(updatedDelivery.status).toBe(DeliveryStatus.DELIVERED);
      expect(updatedDelivery.attempts).toBe(1);
      expect(updatedDelivery.logs).toHaveLength(1);
      expect(updatedDelivery.logs[0]!.statusCode).toBe(200);

   });

   it("should mark delivery as DEAD after max failed attempts", async () => {
      const subscriber = await db.subscriber.create({
         data: {
            name: "Test Subscriber",
            targetUrl: "https://example.com/webhook",
            secret: "test-secret",
            eventTypes: ["order.created"],
         }
      });

      const event = await db.event.create({
         data: {
            eventType: "order.created",
            payload: { orderId: "test-456" },
            deliveries: {
               create: [{
                  subscriberId: subscriber.id,
                  maxAttempts: 3, // Set max attempts to 3 for testing (faster test)
               }]
            },
         },
         include: { deliveries: true },
      });

      testEventId = event.id;
      testSubscriberId = subscriber.id;

      const delivery = event.deliveries[0];

      if (!delivery) {
         throw new Error("Delivery record was not created");
      }

      // Mock axios failure
      (axios.post as jest.Mock).mockRejectedValue(new Error("Connection refused"));

      // Override 
      await testQueue.add("deliver", { deliveryId: delivery.id }, {
         attempts: 3,
         backoff: { type: "fixed", delay: 100 }, // Faster retries for testing
      });

      // Wait for worker to process all attempts
      await new Promise<void>((resolve, reject) => {
         worker.on("failed", (job) => {
            if (job?.attemptsMade === 3) resolve();
         });
         setTimeout(() => reject(new Error("Job processing timeout")), 15000);
      });

      const updatedDelivery = await db.delivery.findUniqueOrThrow({
         where: { id: delivery.id },
         include: { logs: true },
      });

      expect(updatedDelivery.status).toBe(DeliveryStatus.DEAD);
      expect(updatedDelivery.logs).toHaveLength(3);

   });
});
