import { db as prisma } from "../db/index";
import axios from "axios";
import { logger } from "../utils/logger";
import { DeliveryStatus } from "@prisma/client";
import { UnrecoverableError } from "bullmq";
import { sign } from "./signPayload";


export class DeliveryService {
   /**
    * Attempts an HTTP delivery for a given deliveryId and records the result in DeliveryLog.
    */

   async attemptDelivery(deliveryId: string, attemptNumber: number, db = prisma): Promise<void> {
      logger.debug(`Starting delivery attempt for ${deliveryId}, attempt number: ${attemptNumber}...`);

      const delivery = await db.delivery.findUniqueOrThrow({
         where: { id: deliveryId },
         include: {
            event: { select: { payload: true, eventType: true } },
            subscriber: { select: { targetUrl: true, secret: true } }
         }
      });

      const { subscriber, event } = delivery;

      logger.debug(`Fetched subscriber and event details: targetUrl=${subscriber.targetUrl}, secret=${subscriber.secret ? "****" : "null"}, eventType=${event.eventType}, payload=${JSON.stringify(event.payload)}`);

      const startTime = Date.now();

      // Sign the payload
      const body = JSON.stringify(event.payload);
      const signature = sign(body, subscriber.secret);

      let statusCode: number | null = null;
      let responseBody: string | null = null;
      let errorMessage: string | null = null;
      let success = false;

      try {
         const response = await axios.post(subscriber.targetUrl, event.payload, {
            headers: {
               "Content-Type": "application/json",
               "X-Webhook-Signature": signature,
               "X-Webhook-Event": event.eventType,
               "X-Webhook-Delivery": deliveryId,
            },
            timeout: 10 * 1000, // 10s
            validateStatus: (status) => status < 500, // only server error codes (5xx) are relevant here
            maxRedirects: 0, // treat redirects as failures to avoid losing event deliveries to unintended endpoints, will throw error if a redirect is encountered
         });

         statusCode = response.status;

         logger.debug(`Received response with status ${statusCode} for delivery ${deliveryId}`);

         const fullResponseBody = JSON.stringify(response.data);
         if (fullResponseBody.length > 1000) {
            logger.info(`Full response body for delivery ${deliveryId}: ${fullResponseBody}`);
         }
         responseBody = fullResponseBody.slice(0, 1000); // Store only first 1000 chars to avoid bloating the DB
         success = response.status >= 200 && response.status < 300;
      } catch (e) {
         if (axios.isAxiosError(e) && e.response && e.response.status >= 300 && e.response.status < 400) {
            // Handle redirects as failures without retrying; subscriber should update targetUrl
            logger.debug(`Redirect encountered with status: ${e.response.status}. Subscriber should update targetUrl to avoid failed deliveries.`);
         }
         else {
            errorMessage = e instanceof Error ? e.message : String(e);
            logger.debug(`Delivery attempt failed for ${deliveryId}: ${errorMessage}`);
         }

         statusCode = axios.isAxiosError(e) && e.response ? e.response.status : null;
      }

      const duration = Date.now() - startTime;
      const isLastAttempt = attemptNumber >= delivery.maxAttempts;

      // Configure new delivery status
      let newStatus: DeliveryStatus;
      if (success) {
         newStatus = DeliveryStatus.DELIVERED;
      }
      // Won't retry a delivery after last attempt or upon receiving a 4xx response (client error)
      else if (isLastAttempt || (statusCode && statusCode >= 300 && statusCode < 500)) {
         newStatus = DeliveryStatus.DEAD;
      } else {
         newStatus = DeliveryStatus.FAILED;
      }

      // Persist attempt log and update delivery automatically
      await db.$transaction([
         db.deliveryLog.create({
            data: {
               deliveryId,
               attemptNumber,
               statusCode,
               responseBody,
               errorMessage,
               duration,
            },
         }),
         db.delivery.update({
            where: { id: deliveryId },
            data: {
               status: newStatus,
               attempts: attemptNumber,
               lastAttemptAt: new Date(),
            },
         }),
      ]);

      // Re-throw to notify BullMQ (notification to retry or mark as failed)
      if (!success) {
         if (isLastAttempt || (statusCode && statusCode >= 300 && statusCode < 500)) {
            throw new UnrecoverableError(errorMessage ?? `Delivery failed with status ${statusCode} and will NOT be retried`); // Won't retry
         }
         throw new Error(errorMessage ?? `Delivery failed with status ${statusCode}; will be retried`); // Will retry
      }
      logger.info(`Delivery ${deliveryId} succeeded on attempt ${attemptNumber}`);
   }
}